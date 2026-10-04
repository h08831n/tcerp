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
        '@foolad/domain': path.resolve(__dirname, 'packages/domain/src'),
        '@foolad/database': path.resolve(__dirname, 'packages/database/src'),
        '@foolad/shared': path.resolve(__dirname, 'packages/shared/src'),
        '@foolad/ui': path.resolve(__dirname, 'packages/ui/src'),
        '@foolad/api': path.resolve(__dirname, 'apps/api/src'),
        '@foolad/worker': path.resolve(__dirname, 'apps/worker/src'),
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
