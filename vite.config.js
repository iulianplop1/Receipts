import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Update this to match your GitHub repository name for GitHub Pages
  // base: '/your-repo-name/',
  plugins: [react()],
  server: {
    port: 3000
  }
})

