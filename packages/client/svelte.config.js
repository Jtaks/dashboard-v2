import adapter from '@sveltejs/adapter-static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      strict: false,
    }),
    paths: {
      relative: false,
    },
    alias: {
      '@dashboard/shared': path.resolve(packageDir, '../shared/src/index.ts'),
    },
  },
};

export default config;
