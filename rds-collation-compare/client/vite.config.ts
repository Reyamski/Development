import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8190,
    proxy: {
      '/api': {
        target: 'http://localhost:8020',
        changeOrigin: true
      }
    }
  }
});
