import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: the same build works on any static host or sub-path.
  base: './',
  plugins: [react()],
  // LAN exposure is opt-in for device testing: pnpm dev --host
  server: { port: 5177 },
  build: { target: 'es2022', sourcemap: true },
});
