import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// GitHub Pages project sites live under /<repo>/ ; the workflow sets VITE_BASE.
export default defineConfig({ base: process.env.VITE_BASE ?? '/', plugins: [react()], test: { include: ['src/**/*.test.ts'] } });
