import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { type Plugin,defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

const alias = {
  '@/main': resolve(__dirname, 'src/main'),
  '@/preload': resolve(__dirname, 'src/preload'),
  '@/renderer': resolve(__dirname, 'src/renderer'),
  '@/shared': resolve(__dirname, 'src/shared'),
}

// Post-process the main bundle to fix Electron incompatibilities:
// node:sqlite — Electron doesn't have this (Node 22+ only). undici (via
// cheerio) includes a SqliteCacheStore that eagerly requires it. We replace
// the require with a stub proxy that throws only if actually used.
function patchMainBundle(): Plugin {
  return {
    name: 'patch-main-bundle',
    generateBundle(_, bundle) {
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') {continue}
        let modified = false

        // Patch node:sqlite (undici via cheerio)
        if (chunk.code.includes('require("node:sqlite")')) {
          chunk.code = chunk.code.replace(
            /require\("node:sqlite"\)/g,
            '(new Proxy({}, { get(_, p) { if (p === "DatabaseSync") throw new Error("node:sqlite is not available in Electron"); return undefined; } }))',
          )
          modified = true
        }

        // Patch canvas optional peer dep (linkedom/cheerio)
        // Vite emits throw for unresolved optional peer deps — replace with no-op
        if (chunk.code.includes('Could not resolve "canvas"')) {
          chunk.code = chunk.code.replace(
            /throw new Error\(`Could not resolve "canvas" imported by "[^"]+"\. Is it installed\?`\);/g,
            '/* canvas is an optional peer dep — not needed */',
          )
          modified = true
        }

        if (modified) {chunk.map = null as any}
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          resolve: { alias },
          plugins: [patchMainBundle()],
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: id => id === 'electron' || id.startsWith('electron/'),
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
          resolve: { alias },
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
  resolve: { alias },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
})
