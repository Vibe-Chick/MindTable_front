import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // /api/* 요청을 백엔드로 전달 (CORS 설정 없이 개발 가능)
  // 기본은 로컬 Django. 배포된 백엔드(Google Cloud 등)로 붙이려면 .env 에 VITE_PROXY_TARGET 설정
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      open: true,
      port: 3000,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false, // 클라우드 임시 인증서(self-signed) 허용
        },
      },
    },
  }
})
