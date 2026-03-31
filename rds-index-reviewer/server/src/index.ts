import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import teleportRouter from './routes/teleport.js';
import healthRouter from './routes/health.js';
import analysisRouter from './routes/analysis.js';
import confluenceRouter from './routes/confluence.js';
import { closeSession } from './services/connection-manager.js';
import { cleanupAll } from './services/teleport.js';

function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    return;
  }
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// Read-only enforcement: block any mutating SQL keywords in request bodies
app.use((req, _res, next) => {
  // Only inspect POST/PUT/PATCH bodies that might contain raw SQL
  if (req.body && typeof req.body.sql === 'string') {
    const sql = req.body.sql.trim().toUpperCase();
    const blocked = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of blocked) {
      if (sql.startsWith(keyword)) {
        _res.status(403).json({ error: `Read-only mode: ${keyword} statements are not allowed.` });
        return;
      }
    }
  }
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/teleport', teleportRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/confluence', confluenceRouter);

app.listen(PORT, () => {
  console.log(`RDS Index Reviewer server running on http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up connections...`);
  await closeSession();
  await cleanupAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
