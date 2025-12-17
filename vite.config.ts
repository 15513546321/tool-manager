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
    // For JAR deployment, use '/' as base path
    // The app will be served from http://server:8080/
    base: '/',
    
    server: {
      // 2. Access Port Configuration (Development)
      // Use PORT environment variable or default to 3000
      port: parseInt(env.PORT) || 3000,
      host: '0.0.0.0',
      open: true,
      proxy: {
        // Proxy API requests to backend during development
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
    },
    build: {
      // 输出到dist目录（后端pom.xml会复制到static目录）
      outDir: './dist',
      assetsDir: 'assets',
      sourcemap: false,
      emptyOutDir: true,
      // 优化构建输出
      rollupOptions: {
        output: {
          // 确保资源正确引用
          assetFileNames: 'assets/[name].[hash][extname]',
          chunkFileNames: 'assets/[name].[hash].js',
          entryFileNames: 'assets/[name].[hash].js',
        }
      }
    }
  };
});