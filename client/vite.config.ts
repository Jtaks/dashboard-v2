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
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
  },
});
