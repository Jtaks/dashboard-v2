import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vite';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(clientRoot, 'src/lib/service-worker/install.ts'),
      formats: ['iife'],
      name: 'dashboardSwPush',
      fileName: () => 'service-worker-push.js',
    },
    outDir: path.resolve(clientRoot, 'static'),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      $lib: path.resolve(clientRoot, 'src/lib'),
    },
  },
});
