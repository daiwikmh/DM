// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Vite only exposes .env through import.meta.env. @prava/db is plain Node code
// shared with the worker, so it reads process.env — populate it here rather
// than coupling the shared package to Vite. In production the host supplies
// the real environment and there is no file to load.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env present — expected in production
}

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});