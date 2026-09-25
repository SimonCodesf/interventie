import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'runtime.js'),
      formats: ['es'],
      fileName: () => 'mindar-runtime.bundle.js',
    },
    outDir: resolve(__dirname, '../js/vendor'),
    emptyOutDir: false,
    minify: 'esbuild',
    target: 'es2019',
  },
});
