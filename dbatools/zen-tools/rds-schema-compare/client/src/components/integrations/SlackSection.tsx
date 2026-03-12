import { useComparisonStore } from '../../store/comparison-store';
import { useSlack } from '../../hooks/useSlack';
import OutputFilterSection from './OutputFilterSection';

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500';

export default function SlackSection() {
  const webhookUrl = useComparisonStore((s) => s.slackWebhookUrl);
  const setWebhookUrl = useComparisonStore((s) => s.setSlackWebhookUrl);
  const useBotToken = useComparisonStore((s) => s.slackUseBotToken);
  const setUseBotToken = useComparisonStore((s) => s.setSlackUseBotToken);
  const botToken = useComparisonStore((s) => s.slackBotToken);
  const setBotToken = useComparisonStore((s) => s.setSlackBotToken);
  const channel = useComparisonStore((s) => s.slackChannel);
  const setChannel = useComparisonStore((s) => s.setSlackChannel);
  const sending = useComparisonStore((s) => s.sendingSlack);
  const result = useComparisonStore((s) => s.slackResult);
  const confluenceResult = useComparisonStore((s) => s.confluenceResult);

  const useSecrets = useComparisonStore((s) => s.slackUseSecrets);
  const setUseSecrets = useComparisonStore((s) => s.setSlackUseSecrets);
  const secretName = useComparisonStore((s) => s.slackSecretName);
  const setSecretName = useComparisonStore((s) => s.setSlackSecretName);
  const secretRegion = useComparisonStore((s) => s.slackSecretRegion);
  const setSecretRegion = useComparisonStore((s) => s.setSlackSecretRegion);
  const secretProfile = useComparisonStore((s) => s.slackSecretProfile);
  const setSecretProfile = useComparisonStore((s) => s.setSlackSecretProfile);
  const testingSecrets = useComparisonStore((s) => s.slackTestingSecrets);
  const secretsTestResult = useComparisonStore((s) => s.slackSecretsTestResult);
  const slackFilter = useComparisonStore((s) => s.slackFilter);
  const setSlackFilter = useComparisonStore((s) => s.setSlackFilter);

  const { runSlack, runSecretTest } = useSlack();

  const canSend = useSecrets
    ? !!(secretName && secretRegion)
    : useBotToken
      ? !!(botToken && channel)
      : !!webhookUrl;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-gray-500">Slack</span>

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
              placeholder="my-app/slack-webhook"
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
        <div className="space-y-1.5">
          {/* Webhook vs Bot Token toggle */}
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="radio"
                name="slackMode"
                checked={!useBotToken}
                onChange={() => setUseBotToken(false)}
              />
              Webhook
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="radio"
                name="slackMode"
                checked={useBotToken}
                onChange={() => setUseBotToken(true)}
              />
              Bot Token <span className="text-gray-600">(enables thread reply)</span>
            </label>
          </div>

          {useBotToken ? (
            <>
              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Bot Token</label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-..."
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-400">Channel</label>
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="#database-migrations"
                  className={inputClass}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs text-gray-400">Webhook URL</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      {/* Confluence link note */}
      {useBotToken && confluenceResult?.pageUrl && (
        <div className="text-xs text-blue-400">
          Confluence link will be included in the message.
        </div>
      )}

      <OutputFilterSection
        filter={slackFilter}
        onFilterChange={setSlackFilter}
        integrationId="slack"
      />

      <button
        onClick={runSlack}
        disabled={sending || !canSend}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
      >
        {sending ? 'Sending...' : 'Send to Slack'}
      </button>
      {result?.success && (
        <div className="text-xs text-green-400">
          {useBotToken ? 'Sent — breakdown posted as thread reply.' : 'Sent successfully.'}
        </div>
      )}
      {result && !result.success && (
        <div className="text-xs text-red-400">{result.error || 'Failed to send'}</div>
      )}
    </div>
  );
}
