import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages base path - matches repository name
  base: '/Receipts/',
  plugins: [react()],
  server: {
    port: 3000
  }
})

