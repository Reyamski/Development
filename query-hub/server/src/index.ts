import express from 'express';
import cors from 'cors';
import teleportRouter from './routes/teleport.js';
import queryRouter from './routes/query.js';
import schemaRouter from './routes/schema.js';
import aiRouter from './routes/ai.js';
import authEmailRouter from './routes/auth-email.js';
import { cleanupAll } from './services/teleport.js';
import { closeSession } from './services/connection-manager.js';
import { assertEmailAuthConfigured } from './services/email-signin.js';

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(
  cors({
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Query-Hub-AI-Provider',
      'X-Query-Hub-Anthropic-Key',
      'X-Query-Hub-OpenAI-Key',
      'X-Query-Hub-OpenAI-Model',
    ],
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'query-hub' });
});

app.use('/api/teleport', teleportRouter);
app.use('/api/query', queryRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/ai', aiRouter);
app.use('/api/auth/email', authEmailRouter);

assertEmailAuthConfigured();

app.listen(PORT, () => {
  console.log(`Query Hub server running on http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up...`);
  await closeSession();
  await cleanupAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
