import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // 1. Force Vite to bundle these immediately
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'three-stdlib' 
    ],
  },
  server: {
    // 2. Ensure the file system allows for the heavy caching needed
    fs: {
      strict: false,
    },
  },
})