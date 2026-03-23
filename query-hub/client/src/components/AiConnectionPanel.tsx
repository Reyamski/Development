import { useEffect, useState } from 'react';
import { useAiSettingsStore, type AiAuthMode } from '../store/ai-settings-store';
import { authEmailStatus, authEmailRequestCode, authEmailVerify } from '../api/client';

const OPENAI_KEYS_URL = 'https://platform.openai.com/api-keys';
const ANTHROPIC_KEYS_URL = 'https://console.anthropic.com/settings/keys';

const modes: { id: AiAuthMode; label: string; hint: string }[] = [
  {
    id: 'server',
    label: 'Server default (team)',
    hint: 'Uses team keys on the API machine. No personal setup.',
  },
  {
    id: 'email_team',
    label: 'Team — work email code',
    hint: 'OTP / email gate (when enabled by admin). Same team keys as above.',
  },
  {
    id: 'anthropic',
    label: 'My Claude — after you log in at Anthropic',
    hint: 'Log in at anthropic.com → create an API key in Console → paste below. Stored in this browser only.',
  },
  {
    id: 'openai',
    label: 'My ChatGPT / OpenAI — after you log in at OpenAI',
    hint: 'Log in at openai.com → open API keys → create key → paste below. ChatGPT Plus ≠ API billing.',
  },
];

export function AiConnectionPanel() {
  const [open, setOpen] = useState(false);
  const [emailAuthReady, setEmailAuthReady] = useState(false);
  const [signInEmail, setSignInEmail] = useState('');
  const [signInCode, setSignInCode] = useState('');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInMsg, setSignInMsg] = useState('');

  const aiAuthMode = useAiSettingsStore((s) => s.aiAuthMode);
  const emailAuthToken = useAiSettingsStore((s) => s.emailAuthToken);
  const emailAuthEmail = useAiSettingsStore((s) => s.emailAuthEmail);
  const anthropicApiKey = useAiSettingsStore((s) => s.anthropicApiKey);
  const openaiApiKey = useAiSettingsStore((s) => s.openaiApiKey);
  const openaiModel = useAiSettingsStore((s) => s.openaiModel);
  const setAiAuthMode = useAiSettingsStore((s) => s.setAiAuthMode);
  const setAnthropicApiKey = useAiSettingsStore((s) => s.setAnthropicApiKey);
  const setOpenaiApiKey = useAiSettingsStore((s) => s.setOpenaiApiKey);
  const setOpenaiModel = useAiSettingsStore((s) => s.setOpenaiModel);
  const setEmailAuth = useAiSettingsStore((s) => s.setEmailAuth);
  const clearPersonalKeys = useAiSettingsStore((s) => s.clearPersonalKeys);
  const clearEmailAuth = useAiSettingsStore((s) => s.clearEmailAuth);

  useEffect(() => {
    if (!open) return;
    void authEmailStatus()
      .then((r) => setEmailAuthReady(r.enabled && r.hasJwtSecret))
      .catch(() => setEmailAuthReady(false));
  }, [open]);

  const label = modes.find((m) => m.id === aiAuthMode)?.label ?? 'AI';

  const requestCode = async () => {
    setSignInMsg('');
    setSignInBusy(true);
    try {
      const r = await authEmailRequestCode(signInEmail.trim());
      setSignInMsg(r.message ?? 'Code sent. Check the API server terminal for the 6-digit code.');
    } catch (e) {
      setSignInMsg(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSignInBusy(false);
    }
  };

  const verifyCode = async () => {
    setSignInMsg('');
    setSignInBusy(true);
    try {
      const r = await authEmailVerify(signInEmail.trim(), signInCode.trim());
      setEmailAuth(r.token, r.email);
      setSignInMsg('Signed in. You can use AI with team keys.');
      setSignInCode('');
    } catch (e) {
      setSignInMsg(e instanceof Error ? e.message : 'Verify failed');
    } finally {
      setSignInBusy(false);
    }
  };

  return (
    <div className="border-b border-par-light-purple/25 bg-par-light-purple/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium text-par-text hover:bg-par-light-purple/15"
      >
        <span>
          Connection: <span className="text-par-purple">{label}</span>
        </span>
        <span className="text-par-text/40">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-par-light-purple/15 pt-2">
          <div className="rounded-xl border-2 border-par-purple/35 bg-gradient-to-br from-par-light-purple/30 to-white p-3 space-y-2">
            <p className="text-xs font-bold text-par-navy">Use your OpenAI or Claude account (API)</p>
            <p className="text-[10px] text-par-text/70 leading-relaxed">
              Hindi maaaring &quot;login lang sa chatgpt.com / claude.ai sa browser&quot; at auto-interpret dito — walang
              official na ganoon para sa third-party apps. Ang flow:{' '}
              <strong>mag-log in ka sa site ng provider</strong> → <strong>gumawa ng API key</strong> →{' '}
              <strong>i-paste dito</strong>. Si Query Hub ang tatawag sa API nila para mag-explain / mag-interpret ng SQL
              at results (same models, billing sa account mo).
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={OPENAI_KEYS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center items-center px-3 py-2 rounded-lg bg-[#10a37f] text-white text-[11px] font-bold border-2 border-black/10 hover:opacity-95 shadow-sm"
              >
                1 · Open OpenAI — log in &amp; create API key ↗
              </a>
              <a
                href={ANTHROPIC_KEYS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center items-center px-3 py-2 rounded-lg bg-par-navy text-white text-[11px] font-bold border-2 border-white/10 hover:bg-par-purple shadow-sm"
              >
                2 · Open Anthropic Console — log in &amp; create API key ↗
              </a>
            </div>
          </div>
          <p className="text-[10px] text-par-text/55 leading-snug">
            Personal API keys: <strong>local storage</strong> sa browser → ipinapadala sa Query Hub API (hindi
            naka-save sa disk ng server). Team email code: session token lang; AI pa rin ang team keys sa server.
          </p>
          <div className="space-y-2">
            {modes.map((m) => {
              const disabled = m.id === 'email_team' && !emailAuthReady;
              return (
                <label
                  key={m.id}
                  className={`flex gap-2 rounded-md border p-2 text-[11px] ${
                    disabled ? 'opacity-50 cursor-not-allowed border-par-light-purple/20' : 'cursor-pointer'
                  } ${aiAuthMode === m.id ? 'border-par-purple bg-par-purple/5' : 'border-par-light-purple/40'}`}
                >
                  <input
                    type="radio"
                    name="ai-auth"
                    disabled={disabled}
                    checked={aiAuthMode === m.id}
                    onChange={() => setAiAuthMode(m.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    <span className="font-semibold text-par-text block">{m.label}</span>
                    <span className="text-par-text/55">{m.hint}</span>
                    {m.id === 'email_team' && !emailAuthReady && (
                      <span className="block text-par-orange/90 mt-1">
                        Not available: admin must set QUERY_HUB_EMAIL_AUTH=true, QUERY_HUB_JWT_SECRET, and
                        QUERY_HUB_EMAIL_DOMAIN (or ALLOWED_EMAILS).
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {aiAuthMode === 'email_team' && emailAuthReady && (
            <div className="rounded-md border border-par-light-purple/40 p-2 space-y-2 bg-white/80">
              {emailAuthToken && emailAuthEmail ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-par-text">
                    Signed in as <strong>{emailAuthEmail}</strong>
                  </p>
                  <button
                    type="button"
                    className="text-[11px] text-par-orange font-medium hover:underline"
                    onClick={() => {
                      clearEmailAuth();
                      setSignInMsg('');
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-par-text/60">
                    Enter your <strong>work email</strong>, request a code, then check the terminal where{' '}
                    <code className="text-[9px] bg-par-light-purple/30 px-1 rounded">npm run dev</code> runs for the
                    6-digit code (15 min). Production can plug in SMTP later.
                  </p>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full text-xs border border-par-light-purple rounded px-2 py-1.5"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={signInBusy || !signInEmail.trim()}
                      onClick={() => void requestCode()}
                      className="text-[11px] px-2 py-1 rounded bg-par-navy text-white disabled:opacity-50"
                    >
                      Send code
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={signInCode}
                    onChange={(e) => setSignInCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full text-xs border border-par-light-purple rounded px-2 py-1.5 font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    disabled={signInBusy || signInCode.length !== 6}
                    onClick={() => void verifyCode()}
                    className="text-[11px] px-2 py-1 rounded bg-par-purple text-white disabled:opacity-50"
                  >
                    Verify & sign in
                  </button>
                </>
              )}
              {signInMsg && <p className="text-[10px] text-par-text/70">{signInMsg}</p>}
            </div>
          )}

          {aiAuthMode === 'anthropic' && (
            <div>
              <label className="text-[10px] font-bold text-par-navy uppercase tracking-wide">
                3 · Paste Anthropic API key
              </label>
              <input
                type="password"
                autoComplete="off"
                placeholder="sk-ant-api03-…"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                className="mt-1 w-full text-xs border border-par-light-purple rounded px-2 py-1.5 font-mono"
              />
            </div>
          )}
          {aiAuthMode === 'openai' && (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold text-par-navy uppercase tracking-wide">
                  3 · Paste OpenAI API key
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="mt-1 w-full text-xs border border-par-light-purple rounded px-2 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-par-navy uppercase tracking-wide">Model</label>
                <input
                  type="text"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="mt-1 w-full text-xs border border-par-light-purple rounded px-2 py-1.5 font-mono"
                />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              clearPersonalKeys();
              clearEmailAuth();
              setSignInMsg('');
            }}
            className="text-[11px] text-par-orange font-medium hover:underline"
          >
            Clear saved API keys & email session
          </button>
        </div>
      )}
    </div>
  );
}
