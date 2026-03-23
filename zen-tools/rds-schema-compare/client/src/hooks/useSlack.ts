import { useCallback } from 'react';
import { sendToSlack, testSecret } from '../api/client';
import { useComparisonStore } from '../store/comparison-store';

export function useSlack() {
  const results = useComparisonStore((s) => s.results);
  const summary = useComparisonStore((s) => s.summary);
  const instanceName = useComparisonStore((s) => s.instanceName);
  const databaseName = useComparisonStore((s) => s.databaseName);
  const targetPath = useComparisonStore((s) => s.targetPath);
  const slackWebhookUrl = useComparisonStore((s) => s.slackWebhookUrl);
  const slackUseBotToken = useComparisonStore((s) => s.slackUseBotToken);
  const slackBotToken = useComparisonStore((s) => s.slackBotToken);
  const slackChannel = useComparisonStore((s) => s.slackChannel);
  const confluenceResult = useComparisonStore((s) => s.confluenceResult);
  const slackUseSecrets = useComparisonStore((s) => s.slackUseSecrets);
  const slackSecretName = useComparisonStore((s) => s.slackSecretName);
  const slackSecretRegion = useComparisonStore((s) => s.slackSecretRegion);
  const slackSecretProfile = useComparisonStore((s) => s.slackSecretProfile);
  const slackFilter = useComparisonStore((s) => s.slackFilter);
  const setSendingSlack = useComparisonStore((s) => s.setSendingSlack);
  const setSlackResult = useComparisonStore((s) => s.setSlackResult);
  const setSlackTestingSecrets = useComparisonStore((s) => s.setSlackTestingSecrets);
  const setSlackSecretsTestResult = useComparisonStore((s) => s.setSlackSecretsTestResult);
  const setError = useComparisonStore((s) => s.setError);

  const runSlack = useCallback(async () => {
    if (!summary) {
      setError('No comparison results to send');
      return;
    }
    if (!slackUseSecrets && !slackUseBotToken && !slackWebhookUrl) {
      setError('Slack webhook URL or bot token is required');
      return;
    }
    if (slackUseBotToken && (!slackBotToken || !slackChannel)) {
      setError('Bot token and channel are required');
      return;
    }
    if (slackUseSecrets && (!slackSecretName || !slackSecretRegion)) {
      setError('Secret name and AWS region are required');
      return;
    }

    setSendingSlack(true);
    setSlackResult(null);
    try {
      const changed = results.filter((r) => r.status !== 'unchanged');
      const body: Parameters<typeof sendToSlack>[0] = {
        results: changed,
        summary,
        schemaContext: instanceName && databaseName ? { instanceName, databaseName } : undefined,
        targetPath,
        filter: slackFilter,
        confluencePageUrl: confluenceResult?.pageUrl,
      };

      if (slackUseSecrets) {
        body.secrets = {
          secretName: slackSecretName,
          region: slackSecretRegion,
          profile: slackSecretProfile || undefined,
        };
      } else if (slackUseBotToken) {
        body.config = { botToken: slackBotToken, channel: slackChannel };
      } else {
        body.config = { webhookUrl: slackWebhookUrl };
      }

      const data = await sendToSlack(body);
      setSlackResult(data);
    } catch (err: any) {
      setSlackResult({ success: false, error: err.message });
    } finally {
      setSendingSlack(false);
    }
  }, [
    results, summary, instanceName, databaseName, targetPath,
    slackWebhookUrl, slackUseBotToken, slackBotToken, slackChannel,
    slackUseSecrets, slackSecretName, slackSecretRegion, slackSecretProfile,
    slackFilter, confluenceResult, setSendingSlack, setSlackResult, setError,
  ]);

  const runSecretTest = useCallback(async () => {
    if (!slackSecretName || !slackSecretRegion) return;
    setSlackTestingSecrets(true);
    setSlackSecretsTestResult(null);
    try {
      const result = await testSecret({
        secretName: slackSecretName,
        region: slackSecretRegion,
        profile: slackSecretProfile || undefined,
      });
      setSlackSecretsTestResult(result);
    } catch (err: any) {
      setSlackSecretsTestResult({ valid: false, keys: [], error: err.message });
    } finally {
      setSlackTestingSecrets(false);
    }
  }, [slackSecretName, slackSecretRegion, slackSecretProfile, setSlackTestingSecrets, setSlackSecretsTestResult]);

  return { runSlack, runSecretTest };
}
