import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['baseLocale'],
    }),
  ],
  server: {
    // Reachable from the Caddy container via host.docker.internal (dev-environment).
    host: true,
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:8080',
    hmr: {
      clientPort: 8080,
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
  },
});
