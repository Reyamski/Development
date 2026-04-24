import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /** When the API runs on e.g. dba-kiro, point dev proxy here (often after `tsh ssh -L 3009:127.0.0.1:3009 …`). */
  const apiTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3004';

  return {
    plugins: [react()],
    server: {
      port: 5192,
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
