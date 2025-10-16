import { getPool, sql } from '../db.js';

// ดึงสินค้าทั้งหมดพร้อมหมวดหมู่
export const getProducts = async (req, res, next) => {
    const { query } = req.query;  // ดึงคำค้นหาจาก query string

    try {
        const pool = await getPool();
        
        // ถ้ามีคำค้นหาจากผู้ใช้
        let sqlQuery = `
            SELECT p.product_code AS code, p.product_name AS name, p.price, p.stock, p.image_url,
                   c.category_code, c.category_name
            FROM products p
            JOIN categories c ON c.category_code = p.category_code
        `;

        // ถ้ามีคำค้นหา เพิ่มเงื่อนไข WHERE เพื่อค้นหาชื่อสินค้าที่ตรงกับคำค้นหา
          if (query) {
            // ใช้ parameterized query เพื่อหลีกเลี่ยง SQL injection
            sqlQuery += ` WHERE p.product_name LIKE @query`; // ใช้ @query ใน SQL
        }
        // จัดเรียงข้อมูลตาม product_code
        sqlQuery += ' ORDER BY p.product_code';

        const result = await pool.request()
            .input('query', sql.VarChar(150), `%${query}%`) // กำหนดค่าให้กับ @query
            .query(sqlQuery);
        res.json(result.recordset);
    } catch (err) {
        next(err);
    }
};


// เพิ่มสินค้าใหม่
export const createProduct = async (req, res, next) => {
    try {
        const { code, name, price, stock = 0, categoryCode , image_Url} = req.body;
        const pool = await getPool();
        await pool.request()
            .input('code', sql.Char(4), code)
            .input('name', sql.VarChar(150), name)
            .input('price', sql.Decimal(10, 2), price)
            .input('stock', sql.Int, stock)
            .input('cat', sql.Char(4), categoryCode)
            .input('image_url', sql.VarChar(255), image_Url)
            .query(`
        INSERT INTO products(product_code, product_name, price, stock, category_code, image_url)
        VALUES (@code, @name, @price, @stock, @cat, @image_url)
      `);

        res.status(201).json({ code, name, price, stock, categoryCode, image_Url });
    } catch (err) {
        // ตรวจจับ error duplicate (รหัสซ้ำ)
        if (err.number === 2627) {
            return res.status(409).json({ error: 'Duplicate product_code' });
        }
        next(err);
    }
};

export const purchaseProduct = async (req, res, next) => {
    const { code } = req.params;
    const qty = Number(req.body.qty);

    // validate เบื้องต้น
    if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'qty must be a positive integer' });
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
        // ป้องกัน race condition
        await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request = new sql.Request(tx);

        // ล็อกแถวสินค้าก่อนอ่าน (ใกล้เคียง SELECT FOR UPDATE)
        const r1 = new sql.Request(tx);
        const prod = await r1
            .input('code', sql.Char(4), code)
            .query(`
                SELECT product_code, product_name, stock
                FROM products WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
                WHERE product_code = @code
            `);

        if (prod.recordset.length === 0) {
            await tx.rollback();
            return res.status(404).json({ error: `Product ${code} not found` });
        }

        const { stock } = prod.recordset[0];

        // เช็กสต็อก
        if (qty > stock) {
            await tx.rollback();
            return res.status(409).json({
                error: 'Insufficient stock',
                remaining: stock,
                message: `สินค้านี้มีสต็อกคงเหลือ ${stock} ชิ้น`
            });
        }

        // หักสต็อก
        const r2 = new sql.Request(tx);
        await r2
            .input('qty', sql.Int, qty)
            .input('code', sql.Char(4), code)
            .query(`
                UPDATE products
                SET stock = stock - @qty
                WHERE product_code = @code
            `);

        const stockAfter = stock - qty;
        await tx.commit();

        return res.status(200).json({
            code,
            deducted: qty,
            stockBefore: stock,
            stockAfter
        });

    } catch (err) {
        try { if (tx._aborted !== true) await tx.rollback(); } catch { }
        next(err);
    }
};