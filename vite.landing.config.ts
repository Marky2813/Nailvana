import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function landingDevRoutes(): Plugin {
  return {
    name: 'landing-dev-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''

        if (url === '/' || url === '/Nailavana' || url === '/Nailavana/') {
          req.url = '/landing.html'
        }

        if (url.endsWith('/landing.html/')) {
          req.url = url.replace(/\/$/, '')
        }

        next()
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), landingDevRoutes()],
  base: command === 'serve' ? '/' : '/Nailavana/',
  build: {
    outDir: 'dist-landing',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'landing.html'),
    },
  },
  server: {
    port: 5124,
    strictPort: true,
    open: '/landing.html',
  },
  preview: {
    port: 5124,
    strictPort: true,
  },
}))
