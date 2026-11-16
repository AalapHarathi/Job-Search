import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Pages serves the site from /<repo-name>/. The deploy workflow sets
// VITE_BASE_PATH automatically; locally it defaults to "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    resolve: { alias: { '@shared': path.resolve(__dirname, 'shared'), '@': path.resolve(__dirname, 'src') } },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            charts: ['recharts'],
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
