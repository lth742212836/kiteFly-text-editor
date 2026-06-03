/**
 * scripts/dev.js - 开发模式启动脚本
 * 
 * 同时启动 Vite 开发服务器和 Electron 应用。
 * Vite 提供 HMR（热模块替换），Electron 在开发服务器就绪后启动。
 */

const { spawn } = require('child_process')
const { createServer } = require('vite')
const path = require('path')

async function startDev() {
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
