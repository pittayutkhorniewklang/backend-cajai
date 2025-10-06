// src/db.js
import 'dotenv/config';      // โหลดค่า .env เข้าสู่ process.env
import sql from 'mssql';

// แปลง string -> boolean แบบปลอดภัย
const toBool = (v, def = false) =>
  (typeof v === 'string' ? v.toLowerCase() === 'true' : def);

const config = {
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'yourStrong(!)Password',
  database: process.env.MSSQL_DB || 'cafe_db',
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT || 1433),
  options: {
    encrypt: toBool(process.env.MSSQL_ENCRYPT, true),                // true เมื่อมี TLS/Azure
    trustServerCertificate: toBool(process.env.MSSQL_TRUST_SERVER_CERT, true),
    enableArithAbort: true,                                          // ค่า default ของ mssql รุ่นใหม่
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;

/** ใช้ pool เดียวทั้งแอป; เรียกซ้ำได้ */
export async function getPool() {
  if (pool) return pool;
  try {
    pool = await sql.connect(config);
    console.log(`✅ Connected to SQL Server: ${config.database}`);
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
}

export { sql };
