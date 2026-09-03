import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      '@framework': fileURLToPath(new URL('../.live2d-sdk/Framework/src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    emptyOutDir: false,
    outDir: fileURLToPath(new URL('../public/live2d', import.meta.url)),
    lib: {
      entry: `${here}runtime-entry.ts`,
      name: 'SoonLive2D',
      formats: ['iife'],
      fileName: () => 'runtime.js',
    },
  },
})
