import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so forwarded ports (Codespaces) are reachable
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
