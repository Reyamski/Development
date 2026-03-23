import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useQueryStore, type AiPanelRequest } from '../store/query-store';
import { useAiSettingsStore } from '../store/ai-settings-store';
import { aiAsk, aiAnalyzeContext, aiExplainSql, aiGenerateSql, aiOptimizeSql } from '../api/client';
import { AiConnectionPanel } from './AiConnectionPanel';

type Mode = 'ask' | 'explain' | 'optimize' | 'generate';

export function AiAssistant({
  onClose,
  panelRequest,
  onPanelRequestConsumed,
}: {
  onClose: () => void;
  panelRequest: AiPanelRequest | null;
  onPanelRequestConsumed: () => void;
}) {
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);
  const editorSql = useQueryStore((s) => s.editorSql);
  const setEditorSql = useQueryStore((s) => s.setEditorSql);
  const aiAuthMode = useAiSettingsStore((s) => s.aiAuthMode);

  const [mode, setMode] = useState<Mode>('ask');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [sqlSuggestion, setSqlSuggestion] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestGen = useRef(0);

  useEffect(() => {
    if (!panelRequest) return;
    const gen = ++requestGen.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      setSqlSuggestion(undefined);
      setMode('explain');
      setOutput('');
      try {
        if (panelRequest.action === 'analyze_explain_plan') {
          const r = await aiAnalyzeContext({
            mode: 'explain_plan',
            sql: panelRequest.sql,
            database: panelRequest.database,
            explainPlan: panelRequest.explainPlan,
          });
          if (!cancelled && gen === requestGen.current) setOutput(r.explanation);
        } else if (panelRequest.action === 'analyze_results') {
          const r = await aiAnalyzeContext({
            mode: 'result_sample',
            sql: panelRequest.sql,
            database: panelRequest.database,
            columns: panelRequest.columns,
            rows: panelRequest.rows,
          });
          if (!cancelled && gen === requestGen.current) setOutput(r.explanation);
        } else {
          const r = await aiExplainSql({
            sql: panelRequest.sql,
            database: panelRequest.database,
          });
          if (!cancelled && gen === requestGen.current) setOutput(r.explanation);
        }
      } catch (e) {
        if (!cancelled && gen === requestGen.current) {
          setError(e instanceof Error ? e.message : 'Request failed');
          setOutput('');
        }
      } finally {
        if (!cancelled && gen === requestGen.current) {
          setLoading(false);
          onPanelRequestConsumed();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [panelRequest, onPanelRequestConsumed]);

  const run = async () => {
    setLoading(true);
    setError('');
    setSqlSuggestion(undefined);
    try {
      if (mode === 'ask') {
        const r = await aiAsk({
          message: input,
          database: selectedDatabase || undefined,
          includeSchema: !!selectedDatabase,
        });
        setOutput(r.message);
        setSqlSuggestion(r.sqlSuggestion);
      } else if (mode === 'explain') {
        const r = await aiExplainSql({ sql: editorSql, database: selectedDatabase || undefined });
        setOutput(r.explanation);
      } else if (mode === 'optimize') {
        const r = await aiOptimizeSql({ sql: editorSql, database: selectedDatabase || undefined });
        setOutput(r.message);
        setSqlSuggestion(r.optimizedSql);
      } else {
        const r = await aiGenerateSql({ prompt: input, database: selectedDatabase || undefined });
        setOutput(r.message);
        setSqlSuggestion(r.sql);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setOutput('');
    } finally {
      setLoading(false);
    }
  };

  const providerSubtitle =
    aiAuthMode === 'server'
      ? 'Team / server key'
      : aiAuthMode === 'email_team'
        ? 'Team — signed in with work email'
        : aiAuthMode === 'anthropic'
          ? 'Your Claude API key'
          : 'Your OpenAI API key';

  const modes: { id: Mode; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'explain', label: 'Explain SQL' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'generate', label: 'Generate' },
  ];

  return (
    <div className="w-[380px] shrink-0 border-l border-par-light-purple/30 bg-white flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-par-light-purple/30">
        <div>
          <span className="text-sm font-semibold text-par-text block">AI assistant</span>
          <span className="text-[10px] text-par-text/50">{providerSubtitle}</span>
        </div>
        <button type="button" className="text-par-text/50 hover:text-par-text text-lg leading-none" onClick={onClose}>
          ×
        </button>
      </div>
      <AiConnectionPanel />
      <div className="flex flex-wrap gap-1 p-2 border-b border-par-light-purple/20">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`text-xs px-2 py-1 rounded ${mode === m.id ? 'bg-par-purple text-white' : 'bg-par-light-purple/20'}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
        {(mode === 'ask' || mode === 'generate') && (
          <textarea
            className="w-full min-h-[80px] text-xs border border-par-light-purple rounded p-2"
            placeholder={mode === 'generate' ? 'Describe the query you need…' : 'Ask a question…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        )}
        {(mode === 'explain' || mode === 'optimize') && (
          <p className="text-xs text-par-text/60">Uses SQL from the main editor. Use results toolbar for EXPLAIN / result-set analysis.</p>
        )}
        <button
          type="button"
          className="py-2 rounded bg-par-purple text-white text-xs font-medium disabled:opacity-50"
          disabled={loading || ((mode === 'ask' || mode === 'generate') && !input.trim())}
          onClick={() => void run()}
        >
          {loading ? '…' : 'Send'}
        </button>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto text-xs whitespace-pre-wrap text-par-text/90 border border-par-light-purple/30 rounded p-2 bg-par-light-purple/10">
          {output || <span className="text-par-text/40">Response appears here.</span>}
        </div>
        {sqlSuggestion && (
          <div className="space-y-1">
            <p className="text-[10px] text-par-text/50">Suggested SQL</p>
            <pre className="text-[10px] font-mono bg-[#1e1e1e] text-gray-100 p-2 rounded max-h-32 overflow-auto">
              {sqlSuggestion}
            </pre>
            <button
              type="button"
              className="text-xs text-par-purple font-medium"
              onClick={() => setEditorSql(sqlSuggestion)}
            >
              Insert into editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
