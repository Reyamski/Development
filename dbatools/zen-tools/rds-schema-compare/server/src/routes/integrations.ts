import { Router, Request, Response } from 'express';
import { sendToSlack, sendToSlackWithThread } from '../services/integrations/slack-service.js';
import { publishToConfluence } from '../services/integrations/confluence-service.js';
import { parseSchemaContext } from '../services/integrations/path-parser.js';
import { fetchSecret, testSecret } from '../services/integrations/secrets-service.js';
import type { SchemaContext, OutputFilter, ConfluenceConfig } from '../services/integrations/types.js';

function resolveSchemaContext(body: any): SchemaContext {
  if (body.schemaContext?.instanceName && body.schemaContext?.databaseName) {
    return body.schemaContext;
  }
  if (body.targetPath) {
    return parseSchemaContext(body.targetPath);
  }
  return { instanceName: 'unknown', databaseName: 'unknown' };
}

function resolveFilter(filter?: Partial<OutputFilter>): OutputFilter {
  return {
    includeAdded: filter?.includeAdded ?? true,
    includeRemoved: filter?.includeRemoved ?? true,
    includeModified: filter?.includeModified ?? true,
    detailLevel: filter?.detailLevel ?? 'full',
    includeCollation: filter?.includeCollation ?? true,
  };
}

const router = Router();

router.get('/secrets-test', async (req: Request, res: Response) => {
  const { secretName, region, profile } = req.query as {
    secretName?: string;
    region?: string;
    profile?: string;
  };

  if (!secretName || !region) {
    res.status(400).json({ valid: false, error: 'secretName and region are required' });
    return;
  }

  try {
    const result = await testSecret({ secretName, region, profile });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ valid: false, keys: [], error: err.message });
  }
});

router.post('/slack', async (req: Request, res: Response) => {
  const { config, secrets, results, summary, filter, confluencePageUrl } = req.body;

  const hasBotToken = config?.botToken && config?.channel;
  const hasWebhook = !!config?.webhookUrl;
  const hasSecrets = !!secrets?.secretName;

  if (!hasBotToken && !hasWebhook && !hasSecrets) {
    res.status(400).json({ error: 'Either config.botToken+channel, config.webhookUrl, or secrets.secretName is required' });
    return;
  }
  if (!results || !summary) {
    res.status(400).json({ error: 'results and summary are required' });
    return;
  }

  try {
    const ctx = resolveSchemaContext(req.body);
    const resolvedFilter = resolveFilter(filter);

    if (secrets?.secretName) {
      const secretValue = await fetchSecret(secrets);
      if (secretValue.slack_bot_token && secretValue.slack_channel) {
        await sendToSlackWithThread(
          secretValue.slack_bot_token,
          secretValue.slack_channel,
          results, summary, ctx, resolvedFilter, confluencePageUrl
        );
      } else if (secretValue.slack_webhook_url) {
        await sendToSlack(secretValue.slack_webhook_url, results, summary, ctx);
      } else {
        res.status(400).json({ error: 'Secret must contain slack_bot_token+slack_channel or slack_webhook_url' });
        return;
      }
    } else if (hasBotToken) {
      await sendToSlackWithThread(
        config.botToken, config.channel,
        results, summary, ctx, resolvedFilter, confluencePageUrl
      );
    } else {
      await sendToSlack(config.webhookUrl, results, summary, ctx);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/confluence', async (req: Request, res: Response) => {
  const { config, secrets, results, summary, filter } = req.body;

  if (!secrets?.secretName && (!config?.baseUrl || !config?.spaceKey || !config?.email || !config?.apiToken)) {
    res.status(400).json({ error: 'Either secrets.secretName or config (baseUrl, spaceKey, email, apiToken) is required' });
    return;
  }
  if (!results || !summary) {
    res.status(400).json({ error: 'results and summary are required' });
    return;
  }

  try {
    const ctx = resolveSchemaContext(req.body);
    const resolvedFilter = resolveFilter(filter);

    let resolvedConfig: ConfluenceConfig;
    if (secrets?.secretName) {
      const secretValue = await fetchSecret(secrets);
      const missing = ['confluence_base_url', 'confluence_space_key', 'confluence_email', 'confluence_api_token']
        .filter((k) => !secretValue[k as keyof typeof secretValue]);
      if (missing.length > 0) {
        res.status(400).json({ error: `Secret is missing required keys: ${missing.join(', ')}` });
        return;
      }
      resolvedConfig = {
        baseUrl: secretValue.confluence_base_url!,
        spaceKey: secretValue.confluence_space_key!,
        email: secretValue.confluence_email!,
        apiToken: secretValue.confluence_api_token!,
        parentPageId: secretValue.confluence_parent_page_id,
        pageTitle: config?.pageTitle,
      };
    } else {
      resolvedConfig = config;
    }

    const result = await publishToConfluence(resolvedConfig, results, summary, ctx, resolvedFilter);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
