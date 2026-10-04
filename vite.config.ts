import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@tcerp/domain': path.resolve(__dirname, 'packages/domain/src'),
        '@tcerp/database': path.resolve(__dirname, 'packages/database/src'),
        '@tcerp/shared': path.resolve(__dirname, 'packages/shared/src'),
        '@tcerp/ui': path.resolve(__dirname, 'packages/ui/src'),
        '@tcerp/api': path.resolve(__dirname, 'apps/api/src'),
        '@tcerp/worker': path.resolve(__dirname, 'apps/worker/src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
