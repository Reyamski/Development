import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** How AI calls are authenticated */
export type AiAuthMode = 'server' | 'email_team' | 'anthropic' | 'openai';

interface AiSettingsState {
  aiAuthMode: AiAuthMode;
  /** Session after work-email verify (Bearer token) */
  emailAuthToken: string | null;
  emailAuthEmail: string | null;
  /** Personal Anthropic (Claude) API key — stored only in browser */
  anthropicApiKey: string;
  /** Personal OpenAI API key — stored only in browser */
  openaiApiKey: string;
  /** e.g. gpt-4o-mini, gpt-4o */
  openaiModel: string;
  setAiAuthMode: (m: AiAuthMode) => void;
  setAnthropicApiKey: (k: string) => void;
  setOpenaiApiKey: (k: string) => void;
  setOpenaiModel: (m: string) => void;
  setEmailAuth: (token: string | null, email: string | null) => void;
  clearPersonalKeys: () => void;
  clearEmailAuth: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      aiAuthMode: 'server',
      emailAuthToken: null,
      emailAuthEmail: null,
      anthropicApiKey: '',
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',

      setAiAuthMode: (aiAuthMode) => set({ aiAuthMode }),
      setAnthropicApiKey: (anthropicApiKey) => set({ anthropicApiKey }),
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      setOpenaiModel: (openaiModel) => set({ openaiModel }),
      setEmailAuth: (emailAuthToken, emailAuthEmail) => set({ emailAuthToken, emailAuthEmail }),
      clearPersonalKeys: () => set({ anthropicApiKey: '', openaiApiKey: '' }),
      clearEmailAuth: () => set({ emailAuthToken: null, emailAuthEmail: null }),
    }),
    {
      name: 'query-hub:ai-settings',
      partialize: (s) => ({
        aiAuthMode: s.aiAuthMode,
        emailAuthToken: s.emailAuthToken,
        emailAuthEmail: s.emailAuthEmail,
        anthropicApiKey: s.anthropicApiKey,
        openaiApiKey: s.openaiApiKey,
        openaiModel: s.openaiModel,
      }),
    },
  ),
);

/** Headers sent with every /api/ai/* request (keys never stored on Query Hub server). */
export function buildAiHeaders(): Record<string, string> {
  const s = useAiSettingsStore.getState();

  if (s.aiAuthMode === 'email_team') {
    const h: Record<string, string> = {
      'X-Query-Hub-AI-Provider': 'email_team',
    };
    if (s.emailAuthToken?.trim()) {
      h.Authorization = `Bearer ${s.emailAuthToken.trim()}`;
    }
    return h;
  }

  const h: Record<string, string> = {
    'X-Query-Hub-AI-Provider': s.aiAuthMode,
  };
  if (s.aiAuthMode === 'anthropic' && s.anthropicApiKey.trim()) {
    h['X-Query-Hub-Anthropic-Key'] = s.anthropicApiKey.trim();
  }
  if (s.aiAuthMode === 'openai') {
    if (s.openaiApiKey.trim()) {
      h['X-Query-Hub-OpenAI-Key'] = s.openaiApiKey.trim();
    }
    const model = s.openaiModel.trim();
    if (model) {
      h['X-Query-Hub-OpenAI-Model'] = model;
    }
  }
  return h;
}
