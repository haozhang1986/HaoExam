import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // 将 /api 请求转发到后端 (使用 127.0.0.1 避免 Windows localhost 解析问题)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      // 静态文件也需要代理
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      // 认证相关
      '/token': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/register': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      // 其他 API 端点
      '/questions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/tags': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/metadata': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/worksheet': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/download-file': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/subjects': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/curriculums': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
})
