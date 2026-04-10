import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

const alias = {
  '@/main': resolve(__dirname, 'src/main'),
  '@/preload': resolve(__dirname, 'src/preload'),
  '@/renderer': resolve(__dirname, 'src/renderer'),
  '@/shared': resolve(__dirname, 'src/shared'),
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          resolve: {
            alias,
          },
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          resolve: {
            alias,
          },
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias,
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
})
