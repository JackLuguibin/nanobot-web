import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const host = process.env.VITE_API_HOST || 'localhost'
const port = process.env.VITE_API_PORT || '8000'
const nanobotWsHost = process.env.VITE_NANOBOT_WS_HOST || 'localhost'
const nanobotWsPort = process.env.VITE_NANOBOT_WS_PORT || '8765'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://${host}:${port}`,
        changeOrigin: true,
      },
      // 控制台 FastAPI 若实现 /ws，开发时可用 VITE_CONSOLE_WS_URL=ws://localhost:3000/ws
      '/ws': {
        target: `ws://${host}:${port}`,
        ws: true,
      },
      // nanobot `ws` channel plugin (nanobot_ext.channels.ws), default port 8765
      '/nanobot-ws': {
        target: `ws://${nanobotWsHost}:${nanobotWsPort}`,
        ws: true,
        rewrite: (p) => p.replace(/^\/nanobot-ws/, '') || '/',
      },
    },
  },
})
