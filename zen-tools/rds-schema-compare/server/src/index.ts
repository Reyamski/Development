import express from 'express';
import cors from 'cors';
import compareRouter from './routes/compare.js';
import generateRouter from './routes/generate.js';
import filesystemRouter from './routes/filesystem.js';
import integrationsRouter from './routes/integrations.js';
import dumpRouter from './routes/dump.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/compare', compareRouter);
app.use('/api/generate', generateRouter);
app.use('/api', filesystemRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/dump', dumpRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
