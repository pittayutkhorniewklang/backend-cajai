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
