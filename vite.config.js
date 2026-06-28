import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api/projects': {
        target: 'https://macondo.hackclub.com',
        changeOrigin: true,
        secure: true,
      },
      '/api/users': {
        target: 'https://macondo.hackclub.com',
        changeOrigin: true,
        secure: true,
      },
      '/slack-proxy': {
        target: 'https://slack.com/api',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/slack-proxy/, ''),
      },
      '/hackclub-ai': {
        target: 'https://ai.hackclub.com/proxy/v1',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/hackclub-ai/, ''),
      },
    }
  }
})
