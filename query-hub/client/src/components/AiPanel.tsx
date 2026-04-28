import { useState, useRef, useEffect, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryStore } from '../store/query-store';
import { useAppStore } from '../store/app-store';
import {
  aiAsk,
  aiExplainSql,
  aiAnalyzeContext,
  aiSsoLogin,
} from '../api/client';

type AiMode = 'ask' | 'explain' | 'explain_plan' | 'result_sample';

interface AiResult {
  mode: AiMode;
  text: string;
  sql?: string;
  model?: string;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-par-purple/40 focus-visible:ring-offset-1';

/* ---------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ---------------------------------------------------------------------- */

/** Map a long bedrock/anthropic model ID to a short, human label. */
function friendlyModelName(model?: string): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes('claude-opus-4-7') || m.includes('claude-opus-4.7')) return 'Claude Opus 4.7';
  if (m.includes('claude-opus-4-1') || m.includes('claude-opus-4.1')) return 'Claude Opus 4.1';
  if (m.includes('claude-opus')) return 'Claude Opus';
  if (m.includes('claude-sonnet-4-7') || m.includes('claude-sonnet-4.7')) return 'Claude Sonnet 4.7';
  if (m.includes('claude-sonnet-4-6') || m.includes('claude-sonnet-4.6')) return 'Claude Sonnet 4.6';
  if (m.includes('claude-sonnet-4-5') || m.includes('claude-sonnet-4.5')) return 'Claude Sonnet 4.5';
  if (m.includes('claude-sonnet-4')) return 'Claude Sonnet 4';
  if (m.includes('claude-3-7-sonnet')) return 'Claude 3.7 Sonnet';
  if (m.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet';
  if (m.includes('claude-3-haiku')) return 'Claude 3 Haiku';
  if (m.includes('claude-haiku')) return 'Claude Haiku';
  // Fall back: strip the bedrock prefix if present
  return model.replace(/^us\.anthropic\./, '').replace(/^anthropic\./, '');
}

/* ---------------------------------------------------------------------- */
/* Icons (inline SVG, no external lib)                                      */
/* ---------------------------------------------------------------------- */

function IconExplain({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 5h16" />
      <path d="M4 12h10" />
      <path d="M4 19h16" />
      <circle cx="18" cy="12" r="2.5" />
    </svg>
  );
}
function IconPlan({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconResultSet({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M9 4v16" />
    </svg>
  );
}
function IconSparkle({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 14l.7 1.9L21.6 17l-1.9.7L19 19.6l-.7-1.9L16.4 17l1.9-.7z" />
    </svg>
  );
}
function IconSend({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20l-4 -9l-9 -4z" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* SQL CodeBlock with copy/insert                                           */
/* ---------------------------------------------------------------------- */

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
      <pre className="px-2.5 py-2 overflow-x-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-par-navy/85 leading-relaxed font-mono">
        {code}
      </pre>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Markdown body — renders headings, lists, bold, code fences (incl. SQL)   */
/* ---------------------------------------------------------------------- */

function MarkdownBody({
  text,
  onInsertSql,
}: {
  text: string;
  onInsertSql: (sql: string) => void;
}) {
  return (
    <div className="ai-md text-xs leading-relaxed text-par-text/90 [overflow-wrap:anywhere] break-words min-w-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="text-[13px] font-bold text-par-navy mt-2 mb-1 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-xs font-bold uppercase tracking-wider text-par-navy/75 mt-2.5 mb-1 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-[11px] font-bold uppercase tracking-wide text-par-navy/65 mt-2 mb-0.5 first:mt-0">{children}</h5>,
          h4: ({ children }) => <h6 className="text-[11px] font-bold text-par-navy/65 mt-2 mb-0.5 first:mt-0">{children}</h6>,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5 marker:text-par-purple/50">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5 marker:text-par-purple/60 marker:font-semibold">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-par-navy">{children}</strong>,
          em: ({ children }) => <em className="italic text-par-text/85">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-par-purple font-semibold underline decoration-par-purple/40 hover:decoration-par-purple">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-par-purple/40 pl-2.5 my-2 text-par-text/70 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-2 border-par-light-purple/60" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-par-light-purple/60">
              <table className="w-full text-[11px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-par-light-purple/40">{children}</thead>,
          th: ({ children }) => <th className="text-left px-2 py-1 font-bold text-par-navy/80 border-b border-par-light-purple">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1 border-b border-par-light-purple/40 align-top">{children}</td>,
          code(props) {
            const { className, children } = props;
            // react-markdown v9+ no longer passes `inline`; detect by className.
            // Fenced blocks always carry a `language-*` class; inline code does not.
            const isFenced = /language-/i.test(className ?? '');
            if (!isFenced) {
              return (
                <code className="rounded bg-par-light-purple/55 border border-par-purple/15 px-1 py-0.5 font-mono text-[10.5px] text-par-navy/90 [overflow-wrap:anywhere]">
                  {children}
                </code>
              );
            }
            const codeText = String(children ?? '').replace(/\n$/, '');
            const isSql = /language-sql/i.test(className ?? '');
            if (isSql) {
              return <CodeBlock code={codeText} onInsert={() => onInsertSql(codeText)} />;
            }
            return (
              <pre className="my-2 rounded-xl border border-par-light-purple/70 bg-[#fbfaff] p-2.5 overflow-x-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[10.5px] font-mono text-par-navy/85 leading-relaxed">
                <code>{codeText}</code>
              </pre>
            );
          },
          // react-markdown wraps fenced code blocks in <pre><code>. Strip the outer
          // <pre> so our <CodeBlock> isn't nested inside another <pre>.
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Per-message card                                                         */
/* ---------------------------------------------------------------------- */

function AiMessage({ result, onInsert }: { result: AiResult; onInsert: (sql: string) => void }) {
  const modeLabel: Record<AiMode, string> = {
    ask: 'Ask AI',
    explain: 'Explain SQL',
    explain_plan: 'Analyze EXPLAIN',
    result_sample: 'Analyze Results',
  };
  const friendly = friendlyModelName(result.model);

  // For "ask" mode, the API may return both prose and a separate sqlSuggestion.
  // For other modes, the markdown itself often already contains a ```sql``` fence
  // which we let MarkdownBody render via CodeBlock. So only strip the explicit
  // sqlSuggestion when it exists.
  const textWithoutSqlBlock = result.sql
    ? result.text.replace(/```sql\n[\s\S]*?```/i, '').trim()
    : result.text;

  return (
    <div className="rounded-xl border border-par-purple/15 bg-white shadow-qh-sm overflow-hidden min-w-0 shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-par-light-purple/40 bg-par-light-purple/25">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-par-navy/70 truncate">
          {modeLabel[result.mode]}
        </span>
        {friendly && (
          <span
            className="ml-auto text-[9.5px] text-par-text/45 font-medium truncate max-w-[10rem]"
            title={result.model}
          >
            {friendly}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5 min-w-0">
        <MarkdownBody text={textWithoutSqlBlock} onInsertSql={onInsert} />
      </div>
      {result.sql && (
        <div className="px-3 pb-3">
          <CodeBlock code={result.sql} onInsert={() => onInsert(result.sql!)} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Skeleton "thinking" state                                                */
/* ---------------------------------------------------------------------- */

function ThinkingSkeleton() {
  return (
    <div className="rounded-xl border border-par-purple/15 bg-white shadow-qh-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-par-light-purple/40 bg-par-light-purple/25">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-par-purple animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-par-navy/70">
          Thinking
        </span>
        <span className="ml-auto flex gap-1" aria-hidden>
          <span className="h-1 w-1 rounded-full bg-par-purple/50 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1 w-1 rounded-full bg-par-purple/50 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1 w-1 rounded-full bg-par-purple/50 animate-bounce" />
        </span>
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className="h-2 rounded bg-par-light-purple/60 animate-pulse w-[85%]" />
        <div className="h-2 rounded bg-par-light-purple/60 animate-pulse w-[70%]" />
        <div className="h-2 rounded bg-par-light-purple/60 animate-pulse w-[92%]" />
        <div className="h-2 rounded bg-par-light-purple/40 animate-pulse w-[55%]" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared error banner — detects SSO/token-expired and offers a re-login    */
/* ---------------------------------------------------------------------- */

function AiErrorBanner({ error }: { error: string }) {
  const [ssoState, setSsoState] = useState<'idle' | 'launching' | 'launched' | 'failed'>('idle');
  const isSsoExpired =
    /token (?:is|has) expired/i.test(error) ||
    /sso session/i.test(error) ||
    /ExpiredToken/i.test(error) ||
    /credentials.*expired/i.test(error) ||
    /refresh failed/i.test(error);

  async function handleRefresh() {
    setSsoState('launching');
    try {
      await aiSsoLogin();
      setSsoState('launched');
    } catch {
      setSsoState('failed');
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 leading-relaxed [overflow-wrap:anywhere]">
      <p className="font-bold mb-0.5">AI request failed</p>
      <p className="text-red-700/85">{error}</p>
      {isSsoExpired && (
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={ssoState === 'launching'}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-par-purple hover:bg-[#5a56c4] disabled:opacity-50 transition-colors ${focusRing}`}
          >
            {ssoState === 'launching' && 'Launching browser…'}
            {ssoState === 'idle' && 'Refresh AWS SSO login'}
            {ssoState === 'launched' && 'Browser opened — complete SSO then Run again'}
            {ssoState === 'failed' && 'Failed — try `aws sso login` in terminal'}
          </button>
          {ssoState === 'launched' && (
            <p className="text-[10px] text-red-700/70 leading-snug">
              Sign in via the browser tab that just opened on the API host. After it says
              <em> &quot;Successfully logged in&quot;</em>, click <strong>Run again</strong> here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sub-tab definitions                                                      */
/* ---------------------------------------------------------------------- */

type SubTab = AiMode;

const SUB_TABS: { id: SubTab; label: string; short: string; icon: ReactNode; description: string }[] = [
  { id: 'explain', label: 'Explain SQL', short: 'Explain', icon: <IconExplain />, description: 'Plain-English breakdown of the current query.' },
  { id: 'explain_plan', label: 'Analyze EXPLAIN', short: 'EXPLAIN', icon: <IconPlan />, description: 'Interpret EXPLAIN output — access types, keys, row estimates.' },
  { id: 'result_sample', label: 'Analyze Results', short: 'Results', icon: <IconResultSet />, description: 'Summarize what the result rows mean.' },
  { id: 'ask', label: 'Ask AI', short: 'Ask', icon: <IconSparkle />, description: 'Free-form chat. Reads the active schema for context.' },
];

const EXAMPLE_PROMPTS = [
  'Top 10 largest tables by data + index size',
  'Slowest queries from performance_schema',
  'Show foreign keys referencing this database',
];

/* ---------------------------------------------------------------------- */
/* Main panel                                                               */
/* ---------------------------------------------------------------------- */

export function AiPanel() {
  const editorSql = useQueryStore((s) => s.editorSql);
  const explainPlan = useQueryStore((s) => s.explainPlan);
  const lastRows = useQueryStore((s) => s.lastRows);
  const lastColumns = useQueryStore((s) => s.lastColumns);
  const lastMeta = useQueryStore((s) => s.lastMeta);
  const requestEditorInsert = useQueryStore((s) => s.requestEditorInsert);
  const selectedDatabase = useAppStore((s) => s.selectedDatabase);

  const [activeTab, setActiveTab] = useState<SubTab>('explain');
  const [loadingMode, setLoadingMode] = useState<AiMode | null>(null);
  const [errorByMode, setErrorByMode] = useState<Partial<Record<AiMode, string>>>({});
  const [resultsByMode, setResultsByMode] = useState<Record<AiMode, AiResult[]>>({
    explain: [],
    explain_plan: [],
    result_sample: [],
    ask: [],
  });
  const [askInput, setAskInput] = useState('');
  const askBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasSql = editorSql.trim().length > 0;
  const hasExplain = Array.isArray(explainPlan) && explainPlan.length > 0;
  const hasResultSet = lastMeta?.kind === 'select' && lastRows.length > 0;

  // Auto-scroll the ask thread when new results arrive in that view
  useEffect(() => {
    if (activeTab === 'ask') askBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [resultsByMode.ask, loadingMode, activeTab]);

  function pushResult(mode: AiMode, r: AiResult) {
    setResultsByMode((prev) => ({ ...prev, [mode]: [...prev[mode], r] }));
  }
  function setError(mode: AiMode, msg: string | null) {
    setErrorByMode((prev) => ({ ...prev, [mode]: msg ?? undefined }));
  }
  function clearMode(mode: AiMode) {
    setResultsByMode((prev) => ({ ...prev, [mode]: [] }));
    setError(mode, null);
  }

  async function runQuickAction(mode: 'explain' | 'explain_plan' | 'result_sample') {
    setLoadingMode(mode);
    setError(mode, null);
    try {
      if (mode === 'explain') {
        const { explanation, model } = await aiExplainSql({ sql: editorSql, database: selectedDatabase || undefined });
        pushResult(mode, { mode, text: explanation, model });
      } else if (mode === 'explain_plan') {
        const { explanation, model } = await aiAnalyzeContext({
          mode: 'explain_plan',
          sql: editorSql,
          database: selectedDatabase || undefined,
          explainPlan: explainPlan!,
        });
        pushResult(mode, { mode, text: explanation, model });
      } else {
        const { explanation, model } = await aiAnalyzeContext({
          mode: 'result_sample',
          sql: editorSql,
          database: selectedDatabase || undefined,
          columns: lastColumns.map((c) => c.name),
          rows: lastRows.slice(0, 25),
        });
        pushResult(mode, { mode, text: explanation, model });
      }
    } catch (e) {
      setError(mode, e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setLoadingMode(null);
    }
  }

  async function handleAsk() {
    const msg = askInput.trim();
    if (!msg) return;
    setAskInput('');
    setLoadingMode('ask');
    setError('ask', null);
    try {
      const { message, sqlSuggestion, model } = await aiAsk({
        message: msg,
        database: selectedDatabase || undefined,
        includeSchema: true,
      });
      pushResult('ask', { mode: 'ask', text: message, sql: sqlSuggestion, model });
    } catch (e) {
      setError('ask', e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setLoadingMode(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleAsk();
    }
  }

  function pickExample(text: string) {
    setAskInput(text);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 gap-2">
      {/* Sub-tab strip */}
      <div role="tablist" aria-label="AI views" className="shrink-0 grid grid-cols-4 gap-1 p-1 rounded-xl bg-par-light-purple/40 border border-par-purple/10">
        {SUB_TABS.map((t) => {
          const active = activeTab === t.id;
          const count = resultsByMode[t.id].length;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              title={t.description}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${focusRing} ${
                active
                  ? 'bg-white text-par-navy shadow-qh-sm ring-1 ring-par-purple/20'
                  : 'text-par-navy/55 hover:text-par-navy hover:bg-white/60'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center ${active ? 'text-par-purple' : 'text-par-navy/45'}`}>
                {t.icon}
              </span>
              <span className="leading-none">{t.short}</span>
              {count > 0 && (
                <span className={`absolute top-1 right-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold ${active ? 'bg-par-purple text-white' : 'bg-par-purple/20 text-par-purple'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Description strip */}
      <div className="shrink-0 px-1 text-[10.5px] text-par-text/55 leading-snug min-h-[26px]">
        {SUB_TABS.find((t) => t.id === activeTab)?.description}
      </div>

      {/* Body — flex-1, full height for the active view */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {activeTab === 'explain' && (
          <QuickActionView
            mode="explain"
            actionLabel="Explain current SQL"
            enabled={hasSql}
            disabledHint="Type or load a query first"
            loading={loadingMode === 'explain'}
            results={resultsByMode.explain}
            error={errorByMode.explain}
            onRun={() => void runQuickAction('explain')}
            onClear={() => clearMode('explain')}
            onInsert={requestEditorInsert}
            icon={<IconExplain className="h-4 w-4" />}
          />
        )}
        {activeTab === 'explain_plan' && (
          <QuickActionView
            mode="explain_plan"
            actionLabel="Analyze EXPLAIN plan"
            enabled={hasExplain}
            disabledHint="Run EXPLAIN on a query first to enable this"
            loading={loadingMode === 'explain_plan'}
            results={resultsByMode.explain_plan}
            error={errorByMode.explain_plan}
            onRun={() => void runQuickAction('explain_plan')}
            onClear={() => clearMode('explain_plan')}
            onInsert={requestEditorInsert}
            icon={<IconPlan className="h-4 w-4" />}
          />
        )}
        {activeTab === 'result_sample' && (
          <QuickActionView
            mode="result_sample"
            actionLabel="Analyze result rows"
            enabled={hasResultSet}
            disabledHint="Run a SELECT first — analyzes the first 25 rows"
            loading={loadingMode === 'result_sample'}
            results={resultsByMode.result_sample}
            error={errorByMode.result_sample}
            onRun={() => void runQuickAction('result_sample')}
            onClear={() => clearMode('result_sample')}
            onInsert={requestEditorInsert}
            icon={<IconResultSet className="h-4 w-4" />}
          />
        )}
        {activeTab === 'ask' && (
          <AskView
            askInput={askInput}
            setAskInput={setAskInput}
            textareaRef={textareaRef}
            bottomRef={askBottomRef}
            results={resultsByMode.ask}
            loading={loadingMode === 'ask'}
            error={errorByMode.ask}
            onSend={() => void handleAsk()}
            onKeyDown={handleKeyDown}
            onPickExample={pickExample}
            onInsert={requestEditorInsert}
            onClear={() => clearMode('ask')}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Quick-action view — used by Explain / EXPLAIN plan / Result sample       */
/* ---------------------------------------------------------------------- */

function QuickActionView({
  mode,
  actionLabel,
  enabled,
  disabledHint,
  loading,
  results,
  error,
  onRun,
  onClear,
  onInsert,
  icon,
}: {
  mode: AiMode;
  actionLabel: string;
  enabled: boolean;
  disabledHint: string;
  loading: boolean;
  results: AiResult[];
  error?: string;
  onRun: () => void;
  onClear: () => void;
  onInsert: (sql: string) => void;
  icon: ReactNode;
}) {
  const hasResults = results.length > 0;
  const showInlineButton = hasResults || loading;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-2">
      {/* Top action bar */}
      {!showInlineButton ? (
        <div className="shrink-0 rounded-xl border border-dashed border-par-purple/30 bg-par-light-purple/15 p-3 text-center">
          <button
            type="button"
            disabled={!enabled || loading}
            onClick={onRun}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-par-purple hover:bg-[#5a56c4] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-qh-sm ${focusRing}`}
          >
            <span className="flex h-4 w-4 items-center justify-center text-white">{icon}</span>
            {actionLabel}
          </button>
          {!enabled && (
            <p className="mt-2 text-[11px] text-par-text/50 leading-relaxed">{disabledHint}</p>
          )}
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            disabled={!enabled || loading}
            onClick={onRun}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-par-purple hover:bg-[#5a56c4] disabled:opacity-40 disabled:cursor-not-allowed transition-all ${focusRing}`}
          >
            <span className="flex h-3 w-3 items-center justify-center">{icon}</span>
            {loading ? 'Running…' : 'Run again'}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-par-navy/70 border border-par-light-purple bg-white hover:bg-par-light-purple/30 disabled:opacity-40 transition-colors ${focusRing}`}
          >
            Clear
          </button>
          <span className="ml-auto text-[10px] text-par-text/40 font-medium">
            {results.length} {results.length === 1 ? 'response' : 'responses'}
          </span>
        </div>
      )}

      {/* Scrollable response area — full remaining height */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-scroll overflow-x-hidden flex flex-col gap-2 always-show-scrollbar">
        {results.map((r, i) => (
          <AiMessage key={`${mode}-${i}`} result={r} onInsert={onInsert} />
        ))}
        {loading && <ThinkingSkeleton />}
        {error && <AiErrorBanner error={error} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Ask view — chat-style with input pinned to bottom                        */
/* ---------------------------------------------------------------------- */

function AskView({
  askInput,
  setAskInput,
  textareaRef,
  bottomRef,
  results,
  loading,
  error,
  onSend,
  onKeyDown,
  onPickExample,
  onInsert,
  onClear,
}: {
  askInput: string;
  setAskInput: (s: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  results: AiResult[];
  loading: boolean;
  error?: string;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPickExample: (text: string) => void;
  onInsert: (sql: string) => void;
  onClear: () => void;
}) {
  const showEmpty = results.length === 0 && !loading && !error;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-2">
      {/* Header strip with clear (only when there's content) */}
      {results.length > 0 && (
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-par-text/40 font-medium">
            {results.length} {results.length === 1 ? 'message' : 'messages'}
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-par-navy/70 border border-par-light-purple bg-white hover:bg-par-light-purple/30 disabled:opacity-40 transition-colors ${focusRing}`}
          >
            Clear chat
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-scroll overflow-x-hidden flex flex-col gap-2 always-show-scrollbar">
        {showEmpty && (
          <div className="px-1 py-2">
            <div className="rounded-xl border border-dashed border-par-purple/30 bg-par-light-purple/15 px-3 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <IconSparkle className="h-3.5 w-3.5 text-par-purple/80" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-par-navy/70">
                  Ask anything about your schema
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-par-text/65">
                The active database schema is included as context. Read-only suggestions only — no DDL or locking operations.
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPickExample(p)}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-par-navy/85 bg-white border border-par-light-purple/70 shadow-qh-inset hover:border-par-purple/40 hover:bg-par-light-purple/20 transition-colors ${focusRing}`}
                  >
                    <span className="text-par-purple/70 mr-1.5">›</span>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {results.map((r, i) => (
          <AiMessage key={`ask-${i}`} result={r} onInsert={onInsert} />
        ))}
        {loading && <ThinkingSkeleton />}
        {error && <AiErrorBanner error={error} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 rounded-xl border border-par-purple/20 bg-white shadow-qh-sm overflow-hidden focus-within:border-par-purple/45 focus-within:shadow-qh transition-all">
        <textarea
          ref={textareaRef}
          rows={3}
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything or describe the query you want…"
          disabled={loading}
          className="w-full resize-none px-2.5 pt-2 pb-1 text-xs text-par-text placeholder:text-par-text/35 bg-transparent focus:outline-none disabled:opacity-50 leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="text-[10px] text-par-text/40 font-medium truncate">
            <kbd className="rounded bg-par-light-purple/70 px-1 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15">⌘/Ctrl</kbd>
            {' '}+{' '}
            <kbd className="rounded bg-par-light-purple/70 px-1 py-0.5 font-sans text-[9px] text-par-navy/85 border border-par-purple/15">Enter</kbd>
            {' '}to send
          </span>
          <button
            type="button"
            disabled={!askInput.trim() || loading}
            onClick={onSend}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-par-purple hover:bg-[#5a56c4] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-all ${focusRing}`}
          >
            <IconSend className="h-3 w-3" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
