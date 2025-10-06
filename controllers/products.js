import { getPool, sql } from '../db.js';

// ดึงสินค้าทั้งหมดพร้อมหมวดหมู่
export const getProducts = async (req, res, next) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT p.product_code AS code, p.product_name AS name, p.price, p.stock,
             c.category_code, c.category_name
      FROM products p
      JOIN categories c ON c.category_code = p.category_code
      ORDER BY p.product_code
    `);
        res.json(result.recordset);
    } catch (err) {
        next(err);
    }
};

// เพิ่มสินค้าใหม่
export const createProduct = async (req, res, next) => {
    try {
        const { code, name, price, stock = 0, categoryCode } = req.body;
        const pool = await getPool();
        await pool.request()
            .input('code', sql.Char(4), code)
            .input('name', sql.VarChar(150), name)
            .input('price', sql.Decimal(10, 2), price)
            .input('stock', sql.Int, stock)
            .input('cat', sql.Char(4), categoryCode)
            .query(`
        INSERT INTO products(product_code, product_name, price, stock, category_code)
        VALUES (@code, @name, @price, @stock, @cat)
      `);

        res.status(201).json({ code, name, price, stock, categoryCode });
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