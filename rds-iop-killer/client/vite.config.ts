import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const monorepoRoot = join(__dirname, '..');
  const env = loadEnv(mode, monorepoRoot, '');
  const API_PORT = env.PORT || '3101';

  return {
    plugins: [react()],
    server: {
      port: 5280,
      strictPort: false,
      proxy: {
        '/api': {
          target: `http://localhost:${API_PORT}`,
          changeOrigin: true,
        },
      },
    },
  };
});
