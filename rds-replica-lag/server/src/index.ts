import express from 'express';
import cors from 'cors';
import teleportRouter from './routes/teleport.js';
import lagRouter from './routes/lag.js';
import { cleanupAll } from './services/teleport.js';
import { closeSession } from './services/connection-manager.js';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

app.use('/api/teleport', teleportRouter);
app.use('/api/lag', lagRouter);

app.listen(PORT, () => {
  console.log(`RDS Replica Lag server running on http://localhost:${PORT}`);
});

// Cleanup tunnels on process termination
async function shutdown(signal: string) {
  console.log(`\n[${signal}] Cleaning up...`);
  await closeSession();
  await cleanupAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
