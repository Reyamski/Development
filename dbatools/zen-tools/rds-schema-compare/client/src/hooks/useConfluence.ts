import { useCallback } from 'react';
import { publishToConfluence, testSecret } from '../api/client';
import { useComparisonStore } from '../store/comparison-store';

export function useConfluence() {
  const results = useComparisonStore((s) => s.results);
  const summary = useComparisonStore((s) => s.summary);
  const instanceName = useComparisonStore((s) => s.instanceName);
  const databaseName = useComparisonStore((s) => s.databaseName);
  const targetPath = useComparisonStore((s) => s.targetPath);
  const confluenceBaseUrl = useComparisonStore((s) => s.confluenceBaseUrl);
  const confluenceSpaceKey = useComparisonStore((s) => s.confluenceSpaceKey);
  const confluenceEmail = useComparisonStore((s) => s.confluenceEmail);
  const confluenceApiToken = useComparisonStore((s) => s.confluenceApiToken);
  const confluenceParentPageId = useComparisonStore((s) => s.confluenceParentPageId);
  const confluencePageTitle = useComparisonStore((s) => s.confluencePageTitle);
  const confluenceUseSecrets = useComparisonStore((s) => s.confluenceUseSecrets);
  const confluenceSecretName = useComparisonStore((s) => s.confluenceSecretName);
  const confluenceSecretRegion = useComparisonStore((s) => s.confluenceSecretRegion);
  const confluenceSecretProfile = useComparisonStore((s) => s.confluenceSecretProfile);
  const confluenceFilter = useComparisonStore((s) => s.confluenceFilter);
  const setPublishingConfluence = useComparisonStore((s) => s.setPublishingConfluence);
  const setConfluenceResult = useComparisonStore((s) => s.setConfluenceResult);
  const setConfluenceTestingSecrets = useComparisonStore((s) => s.setConfluenceTestingSecrets);
  const setConfluenceSecretsTestResult = useComparisonStore((s) => s.setConfluenceSecretsTestResult);
  const setError = useComparisonStore((s) => s.setError);

  const runConfluence = useCallback(async () => {
    if (!summary) {
      setError('No comparison results to publish');
      return;
    }
    if (!confluenceUseSecrets && (!confluenceBaseUrl || !confluenceSpaceKey || !confluenceEmail || !confluenceApiToken)) {
      setError('Confluence base URL, space key, email, and API token are required');
      return;
    }
    if (confluenceUseSecrets && (!confluenceSecretName || !confluenceSecretRegion)) {
      setError('Secret name and AWS region are required');
      return;
    }

    setPublishingConfluence(true);
    setConfluenceResult(null);
    try {
      const changed = results.filter((r) => r.status !== 'unchanged');
      const body: Parameters<typeof publishToConfluence>[0] = {
        results: changed,
        summary,
        schemaContext: instanceName && databaseName ? { instanceName, databaseName } : undefined,
        targetPath,
        filter: confluenceFilter,
      };

      if (confluenceUseSecrets) {
        body.secrets = {
          secretName: confluenceSecretName,
          region: confluenceSecretRegion,
          profile: confluenceSecretProfile || undefined,
        };
        // pageTitle is a display pref, not a credential — pass separately
        if (confluencePageTitle) {
          body.config = { baseUrl: '', spaceKey: '', email: '', apiToken: '', pageTitle: confluencePageTitle };
        }
      } else {
        body.config = {
          baseUrl: confluenceBaseUrl,
          spaceKey: confluenceSpaceKey,
          email: confluenceEmail,
          apiToken: confluenceApiToken,
          parentPageId: confluenceParentPageId || undefined,
          pageTitle: confluencePageTitle || undefined,
        };
      }

      const data = await publishToConfluence(body);
      setConfluenceResult(data);
    } catch (err: any) {
      setConfluenceResult({ success: false, error: err.message });
    } finally {
      setPublishingConfluence(false);
    }
  }, [
    results, summary, instanceName, databaseName, targetPath,
    confluenceBaseUrl, confluenceSpaceKey, confluenceEmail, confluenceApiToken,
    confluenceParentPageId, confluencePageTitle,
    confluenceUseSecrets, confluenceSecretName, confluenceSecretRegion, confluenceSecretProfile,
    confluenceFilter, setPublishingConfluence, setConfluenceResult, setError,
  ]);

  const runSecretTest = useCallback(async () => {
    if (!confluenceSecretName || !confluenceSecretRegion) return;
    setConfluenceTestingSecrets(true);
    setConfluenceSecretsTestResult(null);
    try {
      const result = await testSecret({
        secretName: confluenceSecretName,
        region: confluenceSecretRegion,
        profile: confluenceSecretProfile || undefined,
      });
      setConfluenceSecretsTestResult(result);
    } catch (err: any) {
      setConfluenceSecretsTestResult({ valid: false, keys: [], error: err.message });
    } finally {
      setConfluenceTestingSecrets(false);
    }
  }, [confluenceSecretName, confluenceSecretRegion, confluenceSecretProfile, setConfluenceTestingSecrets, setConfluenceSecretsTestResult]);

  return { runConfluence, runSecretTest };
}
