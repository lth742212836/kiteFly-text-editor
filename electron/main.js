/**
 * electron/main.js - Electron 主进程入口
 * 
 * 职责：
 * 1. 创建应用窗口，管理窗口生命周期
 * 2. 注册 IPC 通信通道，处理渲染进程请求
 * 3. 实现文件系统操作（读取、写入、编码检测）
 * 4. 处理原生菜单和快捷键
 * 5. 管理最近打开的文件列表
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, Tray } = require('electron')
const path = require('path')
const fs = require('fs')

// ============================================================
// 全局状态
// ============================================================

/** @type {BrowserWindow|null} 主窗口实例 */
let mainWindow = null

/** @type {string[]} 最近打开的文件路径列表，最多保存 20 个 */
let recentFiles = []

/**
 * @type {string[]} 待打开的文件路径（macOS Dock 拖拽场景）
 * 在窗口尚未创建时暂存拖拽进来的文件路径
 */
let pendingOpenFiles = []

/** 最近文件列表的存储路径 */
const recentFilePath = path.join(app.getPath('userData'), 'recent-files.json')

// ============================================================
// 判断运行模式：开发模式 or 生产模式
// ============================================================

/**
 * 是否为开发模式
 * 开发模式下从 Vite 开发服务器加载前端资源
 * 生产模式下从打包后的 dist 目录加载
 */
const isDev = !app.isPackaged

// ============================================================
// 应用生命周期
// ============================================================

app.whenReady().then(() => {
  // 加载最近文件列表
  loadRecentFiles()
  
  // 创建主窗口
  createWindow()
  
  // 设置应用菜单
  setApplicationMenu()
  
  // 注册所有 IPC 通信处理器
  registerIpcHandlers()
  
  // macOS: 通过 Finder 拖拽文件到 Dock 图标时打开
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (mainWindow) {
      sendToRenderer('open-files', [filePath])
      mainWindow.focus()
    } else {
      // 窗口尚未创建，暂存路径等待窗口就绪
      pendingOpenFiles.push(filePath)
    }
  })
  
  // macOS: 点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================================
// 窗口创建
// ============================================================

/**
 * 创建主应用窗口
 * 设置窗口尺寸、最小尺寸、加载前端入口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'TxtEdit - 文本编辑器',
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 预加载脚本，暴露安全的 API
      nodeIntegration: false,      // 禁用 Node 集成，安全最佳实践
      contextIsolation: true,      // 启用上下文隔离
      sandbox: false,              // 需要 preload 访问 Node API
      webSecurity: false,          // 开发模式下允许跨域加载资源
    },
  })

  // 开发模式：加载 Vite 开发服务器
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // 自动打开开发者工具
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 处理外部链接在新浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 处理窗口内的文件拖放事件（拦截默认行为，由渲染进程处理）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 防止拖拽文件导致页面导航
    const filePath = url.replace('file://', '')
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      event.preventDefault()
      sendToRenderer('open-files', [filePath])
    }
  })

  // 窗口就绪后，处理之前暂存的待打开文件（macOS Dock 拖拽场景）
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenFiles.length > 0) {
      sendToRenderer('open-files', [...pendingOpenFiles])
      pendingOpenFiles = []
    }
  })
}

// ============================================================
// 应用菜单
// ============================================================

/**
 * 设置应用原生菜单
 * 包含文件、编辑、视图、帮助等标准菜单项
 * macOS 下会合并到系统菜单栏
 */
function setApplicationMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 TxtEdit' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 TxtEdit' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 TxtEdit' },
      ],
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '新建文件',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToRenderer('menu-new-file'),
        },
        {
          label: '打开文件...',
          accelerator: 'CmdOrCtrl+O',
          click: () => handleOpenFile(),
        },
        {
          label: '打开文件夹...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => handleOpenFolder(),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu-save'),
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToRenderer('menu-save-as'),
        },
        { type: 'separator' },
        {
          label: '关闭标签页',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendToRenderer('menu-close-tab'),
        },
        ...(isMac ? [] : [
          { type: 'separator' },
          { role: 'quit', label: '退出' },
        ]),
      ],
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToRenderer('menu-undo'),
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendToRenderer('menu-redo'),
        },
        { type: 'separator' },
        {
          label: '剪切',
          accelerator: 'CmdOrCtrl+X',
          click: () => sendToRenderer('menu-cut'),
        },
        {
          label: '复制',
          accelerator: 'CmdOrCtrl+C',
          click: () => sendToRenderer('menu-copy'),
        },
        {
          label: '粘贴',
          accelerator: 'CmdOrCtrl+V',
          click: () => sendToRenderer('menu-paste'),
        },
        { type: 'separator' },
        {
          label: '查找',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer('menu-find'),
        },
        {
          label: '替换',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendToRenderer('menu-replace'),
        },
        { type: 'separator' },
        {
          label: '全选',
          accelerator: 'CmdOrCtrl+A',
          click: () => sendToRenderer('menu-select-all'),
        },
      ],
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        {
          label: '切换侧边栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendToRenderer('menu-toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+Shift+F5',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: '强制重新加载',
          accelerator: 'CmdOrCtrl+Shift+Alt+F5',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 TxtEdit',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 TxtEdit',
              message: 'TxtEdit v1.0.0',
              detail: '基于 Electron + Vue3 的跨平台文本编辑器\n\n支持多标签页编辑、查找替换、编码检测等功能。\n兼容 macOS、Windows、Linux 平台。',
            })
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ============================================================
// IPC 处理器注册
// ============================================================

/**
 * 注册所有 IPC 通信处理函数
 * 使用 ipcMain.handle 处理渲染进程的异步请求
 */
function registerIpcHandlers() {
  // ---- 文件对话框 ----

  /**
   * 打开文件选择对话框
   * 支持常见文本文件格式过滤
   */
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '所有支持的文件', extensions: ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'go', 'rs', 'php', 'sql', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'csv', 'sh', 'bat', 'ps1', 'vue', 'svelte', 'gitignore', 'env'] },
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.canceled ? [] : result.filePaths
  })

  /**
   * 打开文件夹选择对话框
   */
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开文件夹',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  /**
   * 保存文件对话框
   */
  ipcMain.handle('dialog:saveFile', async (_, defaultPath) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存文件',
      defaultPath: defaultPath || 'untitled.txt',
      filters: [
        { name: '文本文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.canceled ? null : result.filePath
  })

  // ---- 文件系统操作 ----

  /**
   * 读取文件内容（支持编码检测）
   * 使用 iconv-lite 进行编码转换
   * 返回文件大小用于前端大文件检测
   */
  ipcMain.handle('fs:readFile', async (_, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath)
      const fileSize = buffer.length
      const encoding = detectEncoding(buffer)
      
      // 使用 iconv-lite 按检测到的编码解码
      let content = ''
      try {
        const iconv = require('iconv-lite')
        content = iconv.decode(buffer, encoding)
      } catch (e) {
        // 如果 iconv 解码失败，回退到 utf-8
        content = buffer.toString('utf-8')
      }

      // 更新最近文件列表
      addToRecentFiles(filePath)

      return { success: true, content, encoding, fileSize }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 写入文件内容
   * 使用指定的编码格式保存文件
   */
  ipcMain.handle('fs:writeFile', async (_, filePath, content, encoding) => {
    try {
      const iconv = require('iconv-lite')
      const buffer = iconv.encode(content, encoding || 'utf-8')
      fs.writeFileSync(filePath, buffer)
      
      // 更新最近文件列表
      addToRecentFiles(filePath)

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取文件信息（大小、修改时间等）
   */
  ipcMain.handle('fs:getFileInfo', async (_, filePath) => {
    try {
      const stat = fs.statSync(filePath)
      return {
        success: true,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        created: stat.birthtime.toISOString(),
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取最近打开的文件列表
   */
  ipcMain.handle('app:getRecentFiles', () => {
    return recentFiles
  })

  /**
   * 获取文件夹下的文件列表
   */
  ipcMain.handle('fs:listDir', async (_, dirPath) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const textExtensions = [
        '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.xml',
        '.html', '.htm', '.css', '.scss', '.less', '.py', '.java', '.c',
        '.cpp', '.h', '.hpp', '.cs', '.rb', '.go', '.rs', '.php', '.sql',
        '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.log', '.csv',
        '.sh', '.bat', '.ps1', '.vue', '.svelte', '.env', '.gitignore',
      ]
      
      const result = entries
        .filter(e => !e.name.startsWith('.'))
        .map(e => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
          isTextFile: e.isFile() && textExtensions.includes(path.extname(e.name).toLowerCase()),
        }))
        .sort((a, b) => {
          // 目录在前，文件在后
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      
      return { success: true, entries: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 检测文件编码
   */
  ipcMain.handle('fs:detectEncoding', async (_, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath)
      return { success: true, encoding: detectEncoding(buffer) }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  /**
   * 验证文件路径是否为有效的文本文件
   * 用于前端拖拽后验证文件是否可打开
   */
  ipcMain.handle('fs:validateFiles', async (_, filePaths) => {
    const validFiles = []
    for (const filePath of filePaths) {
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile()) {
          validFiles.push(filePath)
        }
      } catch (e) {
        // 文件不存在或无权限，跳过
      }
    }
    return validFiles
  })
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 检测文本编码
 * 优先使用 jschardet 进行智能检测，回退到 UTF-8
 * 
 * @param {Buffer} buffer - 文件内容 Buffer
 * @returns {string} 检测到的编码名称
 */
function detectEncoding(buffer) {
  try {
    const jschardet = require('jschardet')
    const result = jschardet.detect(buffer)
    if (result && result.encoding && result.confidence > 0.5) {
      // 统一编码名称
      const enc = result.encoding.toLowerCase()
      if (enc.includes('gb') || enc.includes('gbk')) return 'gbk'
      if (enc.includes('big5')) return 'big5'
      if (enc.includes('shift')) return 'shift_jis'
      if (enc.includes('euc')) return 'euc-jp'
      return 'utf-8'
    }
  } catch (e) {
    // jschardet 不可用时，检查 BOM 头
  }
  
  // 检查 UTF BOM 标记
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8'
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'utf-16be'
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'utf-16le'
  }
  
  return 'utf-8'
}

/**
 * 添加到最近文件列表
 * 去重并限制最多 20 个，持久化到本地
 * 
 * @param {string} filePath - 文件绝对路径
 */
function addToRecentFiles(filePath) {
  recentFiles = recentFiles.filter(f => f !== filePath)
  recentFiles.unshift(filePath)
  if (recentFiles.length > 20) recentFiles = recentFiles.slice(0, 20)
  saveRecentFiles()
}

/**
 * 加载最近文件列表
 */
function loadRecentFiles() {
  try {
    if (fs.existsSync(recentFilePath)) {
      const data = fs.readFileSync(recentFilePath, 'utf-8')
      recentFiles = JSON.parse(data)
    }
  } catch (e) {
    recentFiles = []
  }
}

/**
 * 保存最近文件列表到磁盘
 */
function saveRecentFiles() {
  try {
    fs.writeFileSync(recentFilePath, JSON.stringify(recentFiles), 'utf-8')
  } catch (e) {
    console.error('保存最近文件列表失败:', e)
  }
}

/**
 * 处理打开文件操作
 * 打开文件选择对话框并通知渲染进程
 */
async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '所有支持的文件', extensions: ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'less', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rb', 'go', 'rs', 'php', 'sql', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'csv', 'sh', 'bat', 'ps1', 'vue', 'svelte', 'gitignore', 'env'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    sendToRenderer('open-files', result.filePaths)
  }
}

/**
 * 处理打开文件夹操作
 */
async function handleOpenFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件夹',
    properties: ['openDirectory'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    sendToRenderer('open-folder', result.filePaths[0])
  }
}

/**
 * 向渲染进程发送消息
 * 
 * @param {string} channel - 消息通道名称
 * @param {*} data - 消息数据
 */
function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data)
  }
}
