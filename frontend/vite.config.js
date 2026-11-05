
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },

  build: {
    // Vercel uses dist; local build goes to Spring Boot static folder
    outDir: process.env.VERCEL
      ? 'dist'
      : '../src/main/resources/static',

    emptyOutDir: true
  }
});
