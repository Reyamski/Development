import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import teleportRouter from './routes/teleport.js';
import scanRouter from './routes/scan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.SERVER_PORT || 4020;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.use('/api/teleport', teleportRouter);
app.use('/api/scan', scanRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 RDS Collation Compare API running on http://localhost:${PORT}`);
});
