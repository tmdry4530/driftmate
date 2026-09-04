import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  publicDir: '../../packages/midnight-contract/managed/character-mandate',
  build: { target: 'esnext' },
  plugins: [react(), wasm()],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      supported: { 'top-level-await': true },
    },
    include: ['@midnight-ntwrk/compact-runtime'],
    exclude: ['@midnight-ntwrk/onchain-runtime-v3'],
  },
  // 5173은 흔히 다른 프로젝트가 쓰고 있어 충돌한다. strictPort로 조용히
  // 다른 포트로 옮겨가는 대신 즉시 실패하게 해서 엉뚱한 앱을 보는 일을 막는다.
  server: { host: '127.0.0.1', port: 5273, strictPort: true },
})
