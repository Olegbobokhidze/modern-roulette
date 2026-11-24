import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { shareMeta } from './share-meta';

export default defineConfig({
  // Relative base: the same build works on any static host or sub-path.
  base: './',
  plugins: [
    react(),
    // Link-preview tags, JSON-LD, robots.txt and sitemap.xml (set SITE_URL for absolute URLs).
    shareMeta({
      author: 'Oleg Bobokhidze',
      genre: "Roulette",
      imageAlt: "Roulette by Oleg Bobokhidze: a minimalist European single-zero wheel on an obsidian table.",
      keywords: ["roulette", "european roulette", "single zero", "casino game", "browser game", "canvas", "react", "typescript"],
    }),
  ],
  // LAN exposure is opt-in for device testing: pnpm dev --host
  server: { port: 5177 },
  build: { target: 'es2022', sourcemap: true },
});
