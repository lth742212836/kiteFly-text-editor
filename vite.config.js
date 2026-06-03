import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

/**
 * Vite 构建配置
 * 
 * 用于构建 Vue3 前端应用，输出到 dist 目录供 Electron 加载。
 * 
 * Monaco Editor 特殊处理：
 * - monaco-editor 使用 web workers 实现语法高亮等特性
 * - 需要配置 worker 打包方式确保正确加载
 */
export default defineConfig({
  plugins: [vue()],
  base: './', // 使用相对路径，确保 Electron file:// 协议下资源加载正常
  root: '.',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'), // @ 别名指向 src 目录
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 确保资源使用相对路径
    assetsDir: 'assets',
    // 增大 chunk 大小警告阈值（monaco-editor 较大）
    chunkSizeWarningLimit: 2000,
    // Rollup 配置
    rollupOptions: {
      output: {
        // 手动分包，将 monaco-editor 单独打包
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
  // 处理 Monaco Editor 的 Web Worker
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    strictPort: true,
    // 允许跨域加载 Monaco Editor 的 web worker
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})
