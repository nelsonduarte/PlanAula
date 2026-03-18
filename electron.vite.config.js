import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: 'src/main/main.js',
        external: ['electron', 'better-sqlite3'],
        output: {
          format: 'cjs',
          entryFileNames: 'main.js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: 'src/main/preload.js',
        output: {
          format: 'cjs',
          entryFileNames: 'preload.js'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer'
    },
    plugins: [react()]
  }
})
