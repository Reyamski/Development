import { useComparisonStore } from '../../store/comparison-store';
import { useConfluence } from '../../hooks/useConfluence';
import OutputFilterSection from './OutputFilterSection';

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500';

export default function ConfluenceSection() {
  const baseUrl = useComparisonStore((s) => s.confluenceBaseUrl);
  const spaceKey = useComparisonStore((s) => s.confluenceSpaceKey);
  const email = useComparisonStore((s) => s.confluenceEmail);
  const apiToken = useComparisonStore((s) => s.confluenceApiToken);
  const parentPageId = useComparisonStore((s) => s.confluenceParentPageId);
  const pageTitle = useComparisonStore((s) => s.confluencePageTitle);
  const setBaseUrl = useComparisonStore((s) => s.setConfluenceBaseUrl);
  const setSpaceKey = useComparisonStore((s) => s.setConfluenceSpaceKey);
  const setEmail = useComparisonStore((s) => s.setConfluenceEmail);
  const setApiToken = useComparisonStore((s) => s.setConfluenceApiToken);
  const setParentPageId = useComparisonStore((s) => s.setConfluenceParentPageId);
  const setPageTitle = useComparisonStore((s) => s.setConfluencePageTitle);
  const publishing = useComparisonStore((s) => s.publishingConfluence);
  const result = useComparisonStore((s) => s.confluenceResult);

  const useSecrets = useComparisonStore((s) => s.confluenceUseSecrets);
  const setUseSecrets = useComparisonStore((s) => s.setConfluenceUseSecrets);
  const secretName = useComparisonStore((s) => s.confluenceSecretName);
  const setSecretName = useComparisonStore((s) => s.setConfluenceSecretName);
  const secretRegion = useComparisonStore((s) => s.confluenceSecretRegion);
  const setSecretRegion = useComparisonStore((s) => s.setConfluenceSecretRegion);
  const secretProfile = useComparisonStore((s) => s.confluenceSecretProfile);
  const setSecretProfile = useComparisonStore((s) => s.setConfluenceSecretProfile);
  const testingSecrets = useComparisonStore((s) => s.confluenceTestingSecrets);
  const secretsTestResult = useComparisonStore((s) => s.confluenceSecretsTestResult);
  const confluenceFilter = useComparisonStore((s) => s.confluenceFilter);
  const setConfluenceFilter = useComparisonStore((s) => s.setConfluenceFilter);

  const { runConfluence, runSecretTest } = useConfluence();

  const canPublish = useSecrets
    ? !!(secretName && secretRegion)
    : !!(baseUrl && spaceKey && email && apiToken);

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-gray-500">Confluence</span>

      {/* AWS Secrets toggle */}
      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={useSecrets}
          onChange={(e) => setUseSecrets(e.target.checked)}
          className="accent-blue-500"
        />
        Use AWS Secrets Manager
      </label>

      {useSecrets ? (
        <div className="space-y-1.5">
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Secret Name / ARN</label>
            <input
              type="text"
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              placeholder="my-app/confluence-creds"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">AWS Region</label>
            <input
              type="text"
              value={secretRegion}
              onChange={(e) => setSecretRegion(e.target.value)}
              placeholder="us-east-1"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">
              AWS Profile <span className="text-gray-600">(optional — for SSO/local dev)</span>
            </label>
            <input
              type="text"
              value={secretProfile}
              onChange={(e) => setSecretProfile(e.target.value)}
              placeholder="default"
              className={inputClass}
            />
          </div>
          <button
            onClick={runSecretTest}
            disabled={testingSecrets || !secretName || !secretRegion}
            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-200 text-xs font-medium py-1.5 px-4 rounded transition-colors"
          >
            {testingSecrets ? 'Testing...' : 'Test Connection'}
          </button>
          {secretsTestResult?.valid && (
            <div className="text-xs text-green-400">
              Connected. Found keys: {secretsTestResult.keys.join(', ')}
            </div>
          )}
          {secretsTestResult && !secretsTestResult.valid && (
            <div className="text-xs text-red-400">{secretsTestResult.error || 'Connection failed'}</div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://yoursite.atlassian.net/wiki"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Space Key</label>
            <input
              type="text"
              value={spaceKey}
              onChange={(e) => setSpaceKey(e.target.value)}
              placeholder="TEAM"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Atlassian API token"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-gray-400">
              Parent Page ID <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={parentPageId}
              onChange={(e) => setParentPageId(e.target.value)}
              placeholder="12345678"
              className={inputClass}
            />
          </div>
        </>
      )}

      {/* Page Title always shown — display preference, not a credential */}
      <div className="space-y-1">
        <label className="block text-xs text-gray-400">
          Page Title <span className="text-gray-600">(optional)</span>
        </label>
        <input
          type="text"
          value={pageTitle}
          onChange={(e) => setPageTitle(e.target.value)}
          placeholder="Auto-generated from date"
          className={inputClass}
        />
      </div>

      <OutputFilterSection
        filter={confluenceFilter}
        onFilterChange={setConfluenceFilter}
        integrationId="confluence"
      />

      <button
        onClick={runConfluence}
        disabled={publishing || !canPublish}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
      >
        {publishing ? 'Publishing...' : 'Publish to Confluence'}
      </button>
      {result?.success && result.pageUrl && (
        <div className="text-xs text-green-400">
          Published:{' '}
          <a
            href={result.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-300"
          >
            {result.pageUrl}
          </a>
        </div>
      )}
      {result && !result.success && (
        <div className="text-xs text-red-400">{result.error || 'Failed to publish'}</div>
      )}
    </div>
  );
}
