import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // relative base so the build works on GitHub Pages project URLs and local file serving
  base: './',
  plugins: [react()],
})
