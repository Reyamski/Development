import express from 'express';
import cors from 'cors';
import teleportRouter from './routes/teleport.js';
import awsRouter from './routes/aws.js';
import healthRouter from './routes/health.js';
import tableSizesRouter from './routes/table-sizes.js';
import stacksRouter from './routes/stacks.js';
import settingsRouter from './routes/settings.js';
import { cleanupAll } from './services/teleport.js';
import { closeAllSessions } from './services/connection-manager.js';
import { restartScheduler } from './services/scheduler.js';

const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

app.use('/api/teleport', teleportRouter);
app.use('/api/aws', awsRouter);
app.use('/api/health', healthRouter);
app.use('/api/table-sizes', tableSizesRouter);
app.use('/api/stacks', stacksRouter);
app.use('/api/settings', settingsRouter);

app.listen(PORT, () => {
  console.log(`DB Health Report server running on http://localhost:${PORT}`);
  restartScheduler();
});

async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up...`);
  await closeAllSessions();
  await cleanupAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
