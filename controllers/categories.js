import { getPool, sql } from '../db.js';

// ดึงหมวดหมู่ทั้งหมด
export const getCategories = async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT category_code AS code, category_name AS name
      FROM categories ORDER BY category_code
    `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
};

// ดึงสินค้าตามหมวดหมู่
export const getProductsByCategory = async (req, res, next) => {
  try {
    const { code } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('code', sql.Char(4), code)
      .query(`
        SELECT p.product_code AS code, p.product_name AS name, p.price, p.stock
        FROM products p
        WHERE p.category_code = @code
        ORDER BY p.product_code
      `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }s
};
