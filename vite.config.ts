import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      // bb.js does `import { pino } from 'pino'` but pino is CJS.
      // Vite can't convert CJS named exports for excluded deps.
      // Point to a minimal ESM stub that provides the named export.
      pino: path.resolve(__dirname, 'src/lib/pino-browser.js'),
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    exclude: ['@noir-lang/noir_js', '@aztec/bb.js'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
