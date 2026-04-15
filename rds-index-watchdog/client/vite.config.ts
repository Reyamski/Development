import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: 'http://localhost:3013',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            const r = res as { headersSent?: boolean; writeHead?: (c: number, h: Record<string, string>) => void; end?: (b: string) => void };
            if (r && !r.headersSent && r.writeHead && r.end) {
              r.writeHead(502, { 'Content-Type': 'application/json' });
              r.end(
                JSON.stringify({
                  error: 'Backend unreachable (port 3013). Run: npm run dev from rds-index-watchdog root.',
                })
              );
            }
          });
        },
      },
    },
  },
});
