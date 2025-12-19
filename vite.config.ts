import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/xyy/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'antd-vendor': ['antd'],
          'antd-icons': ['@ant-design/icons'],
          'antd-x': ['@ant-design/x', '@ant-design/x-markdown'],
        }
      }
    }
  },
  server: {
    port: 5173,
    allowedHosts: ['frpc.aitop.chat'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // 关键：禁用代理缓冲，支持 SSE 流式响应
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // 确保 SSE 响应不被缓冲
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['x-accel-buffering'] = 'no'
            }
          })
        }
      }
    }
  }
})
