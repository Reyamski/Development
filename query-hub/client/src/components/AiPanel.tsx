import { useState, useRef, useEffect } from 'react';
import { useQueryStore } from '../store/query-store';
import { useAppStore } from '../store/app-store';
import {
  aiAsk,
  aiExplainSql,
  aiOptimizeSql,
  aiAnalyzeContext,
} from '../api/client';

type AiMode = 'ask' | 'explain' | 'optimize' | 'explain_plan' | 'result_sample';

interface AiResult {
  mode: AiMode;
  text: string;
  sql?: string;
  model?: string;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple/40 focus-visible:ring-offset-1';

function CodeBlock({ code, onInsert }: { code: string; onInsert: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="mt-2 rounded-xl border border-par-purple/20 bg-par-light-purple/30 overflow-hidden text-[11px]">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-par-purple/10 bg-white/50">
        <span className="font-bold text-par-navy/60 uppercase tracking-widest text-[9px]">SQL</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={copy}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold text-par-navy/70 border border-par-light-purple hover:bg-white transition-colors ${focusRing}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onInsert}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold text-white bg-par-purple hover:bg-[#5a56c4] transition-colors ${focusRing}`}
          >
            Insert
          </button>
        </div>
      </div>
      <pre className="px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-words text-par-navy/85 leading-relaxed font-mono">
        {code}
      </pre>
    </div>
  );
}

function AiMessage({ result, onInsert }: { result: AiResult; onInsert: (sql: string) => void }) {
  const modeLabel: Record<AiMode, string> = {
    ask: 'Ask AI',
    explain: 'Explain SQL',
    optimize: 'Optimize SQL',
    explain_plan: 'Analyze EXPLAIN',
    result_sample: 'Analyze Results',
  };

  return (
    <div className="rounded-xl border border-par-purple/15 bg-white shadow-qh-sm overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-par-light-purple/30 bg-par-light-purple/20">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-par-navy/55">
          {modeLabel[result.mode]}
        </span>
        {result.model && (
          <span className="ml-auto text-[9px] text-par-text/35 font-mono truncate max-w-[8rem]">
            {result.model}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2 text-[11px] leading-relaxed text-par-text/85 whitespace-pre-wrap break-words">
        {result.text}
      </div>
      {result.sql && (
        <div className="px-2.5 pb-2.5">
          <CodeBlock code={result.sql} onInsert={() => onInsert(result.sql!)} />
        </div>
      )}
    </div>
  );
}

export function AiPanel() {
  const editorSql = useQueryStore((s) => s.editorSql);
  const explainPlan = useQueryStore((s) => s.explainPlan);
  const lastRows = useQueryStore((s) => s.lastRows);
  const lastColumns = useQueryStore((s) => s.lastColumns);
  const lastMeta = useQueryStore((s) => s.lastMeta);
  const requestEditorInsert = useQueryStore((s) => s.requestEditorInsert);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AiResult[]>([]);
  const [askInput, setAskInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasSql = editorSql.trim().length > 0;
  const hasExplain = Array.isArray(explainPlan) && explainPlan.length > 0;
  const hasResultSet = lastMeta?.kind === 'select' && lastRows.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results, loading]);

  function pushResult(r: AiResult) {
    setResults((prev) => [...prev, r]);
  }

  async function runAction(mode: AiMode) {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'explain') {
        const { explanation, model } = await aiExplainSql({ sql: editorSql, database: selectedDatabase || undefined });
        pushResult({ mode, text: explanation, model });
      } else if (mode === 'optimize') {
        const { message, optimizedSql, model } = await aiOptimizeSql({ sql: editorSql, database: selectedDatabase || undefined });
        pushResult({ mode, text: message, sql: optimizedSql, model });
      } else if (mode === 'explain_plan') {
        const { explanation, model } = await aiAnalyzeContext({
          mode: 'explain_plan',
          sql: editorSql,
          database: selectedDatabase || undefined,
          explainPlan: explainPlan!,
        });
        pushResult({ mode, text: explanation, model });
      } else if (mode === 'result_sample') {
        const { explanation, model } = await aiAnalyzeContext({
          mode: 'result_sample',
          sql: editorSql,
          database: selectedDatabase || undefined,
          columns: lastColumns.map((c) => c.name),
          rows: lastRows.slice(0, 25),
        });
        pushResult({ mode, text: explanation, model });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk() {
    const msg = askInput.trim();
    if (!msg) return;
    setAskInput('');
    setLoading(true);
    setError(null);
    try {
      const { message, sqlSuggestion, model } = await aiAsk({
        message: msg,
        database: selectedDatabase || undefined,
        includeSchema: true,
      });
      pushResult({ mode: 'ask', text: message, sql: sqlSuggestion, model });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleAsk();
    }
  }

  const actionBtn = (
    label: string,
    mode: AiMode,
    enabled: boolean,
    title: string,
  ) => (
    <button
      type="button"
      disabled={!enabled || loading}
      onClick={() => void runAction(mode)}
      title={title}
      className={`w-full text-left px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${focusRing} ${
        enabled
          ? 'border-par-purple/25 bg-white text-par-navy shadow-qh-sm hover:border-par-purple/45 hover:bg-par-light-purple/20'
          : 'border-par-light-purple/50 bg-par-light-purple/10 text-par-text/40'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      {/* Quick actions */}
      <div className="shrink-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-par-navy/40 mb-1.5 px-0.5">
          Quick actions
        </p>
        <div className="flex flex-col gap-1">
          {actionBtn('Explain SQL', 'explain', hasSql, 'Explain the current SQL in plain English')}
          {actionBtn('Optimize SQL', 'optimize', hasSql, 'Suggest query optimizations')}
          {actionBtn(
            'Analyze EXPLAIN plan',
            'explain_plan',
            hasExplain,
            hasExplain ? 'Analyze the EXPLAIN output' : 'Run EXPLAIN first to enable this',
          )}
          {actionBtn(
            'Analyze result set',
            'result_sample',
            hasResultSet,
            hasResultSet ? 'Summarize and analyze the result grid' : 'Run a SELECT query first to enable this',
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 always-show-scrollbar pr-0.5">
        {results.length === 0 && !loading && !error && (
          <div className="text-center text-[11px] text-par-text/35 mt-4 leading-relaxed px-2">
            Use a quick action above or ask a question below.
          </div>
        )}
        {results.map((r, i) => (
          <AiMessage
            key={i}
            result={r}
            onInsert={(sql) => requestEditorInsert(sql)}
          />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-par-purple/70 font-medium px-1">
            <span className="animate-pulse">●</span>
            Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Ask input */}
      <div className="shrink-0 rounded-xl border border-par-purple/20 bg-white shadow-qh-sm overflow-hidden">
        <textarea
          ref={textareaRef}
          rows={3}
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything or describe the query you want…"
          disabled={loading}
          className={`w-full resize-none px-2.5 pt-2 pb-1 text-[11px] text-par-text placeholder:text-par-text/35 bg-transparent focus:outline-none disabled:opacity-50`}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-[9px] text-par-text/30 font-medium">
            ⌘/Ctrl + Enter to send
          </span>
          <button
            type="button"
            disabled={!askInput.trim() || loading}
            onClick={() => void handleAsk()}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-par-purple hover:bg-[#5a56c4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${focusRing}`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
