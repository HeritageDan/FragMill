import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    strictPort: false,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8080', 10),
    strictPort: false,
    allowedHosts: true,
    cors: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'dexie', 'dexie-react-hooks'],
    exclude: ['xlsx', 'docx', 'jspdf'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          if (id.includes('jspdf')) {
            return 'vendor-jspdf';
          }
          if (id.includes('docx')) {
            return 'vendor-docx';
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
        },
      },
    },
  },
})

