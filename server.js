import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';
import { getPool } from './db.js';
import products from './routes/products.js';
import categories from './routes/categories.js';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', async (req, res) => {
  try {
    await getPool(); // ตรวจว่าต่อ DB ได้
    res.json({ ok: true, time: new Date() });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/products', products);
app.use('/api/categories', categories);




const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
