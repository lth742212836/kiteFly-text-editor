/**
 * scripts/dev.js - 开发模式启动脚本
 * 
 * 同时启动 Vite 开发服务器和 Electron 应用。
 * Vite 提供 HMR（热模块替换），Electron 在开发服务器就绪后启动。
 * 
 * 开发模式下自动编译 C++ 原生模块（如果未编译），失败不影响启动。
 */

const { spawn, execSync } = require('child_process')
const { createServer } = require('vite')
const path = require('path')
const fs = require('fs')

/**
 * 尝试编译 C++ 原生模块（开发模式自动编译）
 */
function ensureNativeModule() {
  const nativePath = path.resolve(__dirname, '..', 'build', 'Release', 'txtedit_native.node')
  
  // 如果已编译，跳过
  if (fs.existsSync(nativePath)) {
    console.log('[Native] C++ 原生模块已存在，跳过编译')
    return
  }
  
  // 如果没有 binding.gyp 也跳过
  const gypPath = path.resolve(__dirname, '..', 'binding.gyp')
  if (!fs.existsSync(gypPath)) {
    console.log('[Native] 未找到 binding.gyp，跳过编译')
    return
  }
  
  try {
    console.log('[Native] 正在编译 C++ 原生模块...')
    execSync('npx node-gyp rebuild', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    })
    console.log('[Native] C++ 原生模块编译成功')
  } catch (e) {
    console.warn('[Native] C++ 原生模块编译失败，将使用 JS 回退方案:', e.message)
  }
}

async function startDev() {
  // 0. 确保 C++ 原生模块已编译（可选，失败不影响启动）
  ensureNativeModule()

  // 1. 启动 Vite 开发服务器
  const server = await createServer({
    configFile: path.resolve(__dirname, '..', 'vite.config.js'),
    root: path.resolve(__dirname, '..'),
  })
  await server.listen()

  console.log(`[Vite] 开发服务器已启动: http://localhost:${server.config.server.port}`)

  // 2. 启动 Electron
  const electronPath = require('electron')
  const electronProcess = spawn(
    electronPath,
    [path.resolve(__dirname, '..', 'electron', 'main.js')],
    {
      stdio: 'inherit',
      env: { ...process.env },
    }
  )

  electronProcess.on('close', (code) => {
    console.log(`[Electron] 进程退出，代码: ${code}`)
    server.close()
    process.exit(code)
  })

  // 优雅退出
  process.on('SIGINT', () => {
    electronProcess.kill()
    server.close()
    process.exit()
  })
}

startDev().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})
