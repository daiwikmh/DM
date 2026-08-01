// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Vite only exposes .env through import.meta.env. @prava/db is plain Node code
// shared with the worker, so it reads process.env — populate it here rather
// than coupling the shared package to Vite. In production the host supplies
// the real environment and there is no file to load.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env present — expected in production
}

// Node adapter is the least-committal SSR target: it runs locally and on any
// container host. Swap with `astro add vercel` / `cloudflare` when the deploy
// target is decided — nothing else in the app depends on it.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
