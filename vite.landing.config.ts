import path from 'path'
import { cpSync } from 'fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function landingDevRoutes(): Plugin {
  return {
    name: 'landing-dev-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''

        if (url === '/' || url === '/Nailvana' || url === '/Nailvana/') {
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

function landingIndexAlias(): Plugin {
  return {
    name: 'landing-index-alias',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist-landing')
      cpSync(path.join(outDir, 'landing.html'), path.join(outDir, 'index.html'))
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), landingDevRoutes(), command === 'build' ? landingIndexAlias() : null].filter(
    Boolean,
  ) as Plugin[],
  base: command === 'serve' ? '/' : '/Nailvana/',
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
    open: '/',
  },
  preview: {
    port: 5124,
    strictPort: true,
  },
}))
