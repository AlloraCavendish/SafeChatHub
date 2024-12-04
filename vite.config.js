import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'client/build', // Ensure this is the correct directory
  },
  
  plugins: [react()],
  optimizeDeps: {
    include: ['qrcode.react']
  }
})
