import { Router, Request, Response } from 'express';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  getTshStatus,
  listDatabases,
  loginDatabase,
  loginTeleport,
  getTshDbCerts,
  startProxyTunnel,
  getAwsAccountId,
  findFreePort,
} from '../services/dump/teleport-service.js';
import { dumpDatabase } from '../services/dump/schema-dumper.js';
import { writeDump } from '../services/dump/file-writer.js';
import { isS3Path, syncToS3 } from '../services/s3-service.js';

interface DumpJob {
  emitter: EventEmitter;
  done: boolean;
}

const jobs = new Map<string, DumpJob>();

function emitLog(job: DumpJob, message: string) {
  job.emitter.emit('event', JSON.stringify({ type: 'log', message }));
}

function emitDone(job: DumpJob, files: number) {
  job.emitter.emit('event', JSON.stringify({ type: 'done', files }));
  job.done = true;
}

function emitError(job: DumpJob, message: string) {
  job.emitter.emit('event', JSON.stringify({ type: 'error', message }));
  job.done = true;
}

async function runDumpJob(
  job: DumpJob,
  proxy: string,
  databases: string[],
  outputBase: string,
  stagingPath: string,
  autoUploadToS3: boolean
) {
  let totalFiles = 0;
  const writeBase = isS3Path(outputBase) ? stagingPath : outputBase;

  try {
    emitLog(job, 'Checking Teleport status...');
    const status = await getTshStatus(proxy);
    if (!status.loggedIn || !status.user) {
      emitError(job, `Not logged in to ${proxy}. Run: tsh login --proxy=${proxy}`);
      return;
    }
    emitLog(job, `Logged in as ${status.user}`);

    emitLog(job, 'Getting AWS account ID...');
    const accountId = await getAwsAccountId();
    emitLog(job, accountId !== 'unknown' ? `Account: ${accountId}` : 'Account ID unavailable — using "unknown" in path');

    emitLog(job, `Fetching database list from ${proxy}...`);
    const allDbs = await listDatabases(proxy);
    const selectedDbs = allDbs.filter((db) => databases.includes(db.name));

    if (selectedDbs.length === 0) {
      emitError(job, 'None of the selected databases were found in Teleport');
      return;
    }

    for (const db of selectedDbs) {
      emitLog(job, `\nLogging into ${db.name}...`);
      await loginDatabase(db.name, proxy);

      emitLog(job, `Reading TLS certs for ${db.name}...`);
      const certs = await getTshDbCerts(db.name, proxy, status.user!);

      emitLog(job, `Starting proxy tunnel for ${db.name}...`);
      const port = await findFreePort();
      let tunnelProc;
      try {
        tunnelProc = await startProxyTunnel(db.name, port, proxy);
        emitLog(job, `Tunnel ready on port ${port}`);

        const dump = await dumpDatabase({
          rdsIdentifier: db.name,
          region: db.region,
          iamUser: status.user!,
          localPort: port,
          certs,
          onProgress: (msg) => emitLog(job, msg),
        });

        const files = await writeDump(dump, writeBase, proxy, accountId, (msg) =>
          emitLog(job, msg)
        );
        totalFiles += files.length;
        emitLog(job, `✓ ${db.name} complete — ${files.length} files written`);
      } finally {
        if (tunnelProc) {
          try { tunnelProc.kill('SIGTERM'); } catch { /* already exited */ }
        }
      }
    }

    if (isS3Path(outputBase) && autoUploadToS3) {
      emitLog(job, `\nUploading to ${outputBase}...`);
      await syncToS3(writeBase, outputBase);
      emitLog(job, `✓ Upload complete`);
    }

    emitDone(job, totalFiles);
  } catch (err: any) {
    emitError(job, err.message || String(err));
  }
}

const router = Router();

router.get('/tsh-login/stream', (req: Request, res: Response) => {
  const { proxy } = req.query as { proxy?: string };
  if (!proxy) {
    res.status(400).json({ error: 'proxy is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const proc = loginTeleport(proxy);
  let done = false;

  const hardTimeout = setTimeout(() => {
    if (!done) {
      done = true;
      proc.kill();
      send({ type: 'error', message: 'tsh login timed out after 120s' });
      res.end();
    }
  }, 120000);

  const onData = (data: Buffer) => {
    data.toString().split('\n').filter(Boolean).forEach((line) => {
      send({ type: 'log', message: line.trim() });
    });
  };

  proc.stdout?.on('data', onData);
  proc.stderr?.on('data', onData);

  proc.on('exit', (code) => {
    if (done) return;
    done = true;
    clearTimeout(hardTimeout);
    if (code === 0) {
      send({ type: 'done' });
    } else {
      send({ type: 'error', message: `tsh login exited with code ${code}` });
    }
    res.end();
  });

  proc.on('error', (err) => {
    if (done) return;
    done = true;
    clearTimeout(hardTimeout);
    send({ type: 'error', message: err.message });
    res.end();
  });

  req.on('close', () => {
    if (!done) proc.kill();
    clearTimeout(hardTimeout);
  });
});

router.get('/status', async (req: Request, res: Response) => {
  const { proxy } = req.query as { proxy?: string };
  if (!proxy) {
    res.status(400).json({ error: 'proxy is required' });
    return;
  }
  try {
    const status = await getTshStatus(proxy);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/databases', async (req: Request, res: Response) => {
  const { proxy } = req.query as { proxy?: string };
  if (!proxy) {
    res.status(400).json({ error: 'proxy is required' });
    return;
  }
  try {
    const databases = await listDatabases(proxy);
    res.json(databases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', (req: Request, res: Response) => {
  const { proxy, databases, outputBase, stagingPath, autoUploadToS3 } = req.body as {
    proxy?: string;
    databases?: string[];
    outputBase?: string;
    stagingPath?: string;
    autoUploadToS3?: boolean;
  };

  if (!proxy || !databases?.length || !outputBase) {
    res.status(400).json({ error: 'proxy, databases, and outputBase are required' });
    return;
  }

  const jobId = randomUUID();
  const job: DumpJob = { emitter: new EventEmitter(), done: false };
  jobs.set(jobId, job);

  const resolvedStagingPath = stagingPath || '/tmp/SchemaDump';
  // Start background job (don't await)
  runDumpJob(job, proxy, databases, outputBase, resolvedStagingPath, !!autoUploadToS3).catch(() => {});

  res.json({ jobId });
});

router.get('/stream/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send any buffered events if job is already done
  if (job.done) {
    res.write(`data: ${JSON.stringify({ type: 'done', files: 0 })}\n\n`);
    res.end();
    jobs.delete(jobId);
    return;
  }

  const onEvent = (data: string) => {
    res.write(`data: ${data}\n\n`);
    const parsed = JSON.parse(data);
    if (parsed.type === 'done' || parsed.type === 'error') {
      res.end();
      jobs.delete(jobId);
    }
  };

  job.emitter.on('event', onEvent);

  req.on('close', () => {
    job.emitter.off('event', onEvent);
    jobs.delete(jobId);
  });
});

export default router;
