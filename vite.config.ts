import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          valkyrie: ['./src/valkyrie/index.ts'],
          sensory: ['./src/sensory/index.ts'],
          alchemy: ['./src/alchemy/index.ts'],
          chronos: ['./src/chronos/index.ts'],
          luma: ['./src/luma/index.tsx'],
        },
      },
    },
  },
  assetsInclude: ['**/*.glsl', '**/*.vert', '**/*.frag'],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
});
