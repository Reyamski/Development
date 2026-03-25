import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /** When the API runs on e.g. dba-kiro, point dev proxy here (often after `tsh ssh -L 3003:127.0.0.1:3003 …`). */
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3003';

  return {
    plugins: [react()],
    server: {
      // Avoid 5175 — often used by other Vite apps / EDT client fallbacks
      port: 5180,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
