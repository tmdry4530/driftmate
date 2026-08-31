import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // 5173은 흔히 다른 프로젝트가 쓰고 있어 충돌한다. strictPort로 조용히
  // 다른 포트로 옮겨가는 대신 즉시 실패하게 해서 엉뚱한 앱을 보는 일을 막는다.
  server: { host: '127.0.0.1', port: 5273, strictPort: true },
})
