import express from 'express';
import cors from 'cors';
import changesRouter from './routes/changes.js';
import jiraRouter from './routes/jira.js';
import databaseRouter from './routes/database.js';
import configRouter from './routes/config.js';
import teleportRouter from './routes/teleport.js';
import { closeSession } from './services/connection-manager.js';
import { cleanupAll } from './services/teleport.js';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.use('/api/teleport', teleportRouter);
app.use('/api/changes', changesRouter);
app.use('/api/jira', jiraRouter);
app.use('/api/database', databaseRouter);
app.use('/api/config', configRouter);

app.listen(PORT, () => {
  console.log(`What Changed? server running on http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up connections...`);
  await closeSession();
  await cleanupAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
