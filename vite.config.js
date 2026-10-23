import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: Number(process.env.PUPIL_WEB_PORT || 5173), strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${process.env.PUPIL_PORT || 4318}`, changeOrigin: false, timeout: 60000 } } },
});
