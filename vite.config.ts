import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    // 1. Deployment Path Configuration
    // Use VITE_BASE_PATH environment variable or default to '/'
    // Example: VITE_BASE_PATH=/app/ npm run build
    base: env.VITE_BASE_PATH || '/',
    
    server: {
      // 2. Access Port Configuration (Development)
      // Use PORT environment variable or default to 3000
      port: parseInt(env.PORT) || 3000,
      open: true,
      proxy: {
        // Proxy API requests to backend during development
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
    }
  };
});