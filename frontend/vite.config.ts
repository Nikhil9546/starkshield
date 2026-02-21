import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    exclude: ['@noir-lang/noir_js', '@aztec/bb.js'],
  },
  build: {
    rollupOptions: {
      // bb.js and noir_js are dynamically imported — mark as external if not available
      // They load WASM at runtime and need special handling
      external: ['@noir-lang/noir_js', '@aztec/bb.js'],
    },
  },
});
