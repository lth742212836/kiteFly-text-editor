/**
 * electron/preload.js - Electron 预加载脚本
 * 
 * 在渲染进程加载前执行，通过 contextBridge 向渲染进程暴露安全的 API。
 * 遵循 Electron 安全最佳实践：使用 contextIsolation + contextBridge，
 * 不直接暴露 Node.js API 给渲染进程。
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * 通过 contextBridge 暴露 electronAPI 到渲染进程的 window 对象
 * 渲染进程可通过 window.electronAPI 调用这些方法
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================
  // 文件对话框操作
  // ============================================================

  /** 打开文件选择对话框，返回选中的文件路径数组 */
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),

  /** 打开文件夹选择对话框，返回选中的文件夹路径 */
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  /** 打开保存文件对话框，返回保存路径 */
  saveFileDialog: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath),

  // ============================================================
  // 文件系统操作
  // ============================================================

  /**
   * 读取文件内容（自动检测编码）
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<{success: boolean, content?: string, encoding?: string, error?: string}>}
   */
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  /**
   * 写入文件内容
   * @param {string} filePath - 文件绝对路径
   * @param {string} content - 文件内容
   * @param {string} encoding - 编码格式（如 'utf-8', 'gbk'）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  writeFile: (filePath, content, encoding) => ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),

  /**
   * 获取文件信息
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, size?: number, modified?: string, created?: string, error?: string}>}
   */
  getFileInfo: (filePath) => ipcRenderer.invoke('fs:getFileInfo', filePath),

  /**
   * 获取文件夹下的内容列表
   * @param {string} dirPath - 文件夹路径
   * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
   */
  listDir: (dirPath) => ipcRenderer.invoke('fs:listDir', dirPath),

  /** 获取最近打开的文件列表 */
  getRecentFiles: () => ipcRenderer.invoke('app:getRecentFiles'),

  /** 从最近文件列表中移除指定文件 */
  removeRecentFile: (filePath) => ipcRenderer.invoke('app:removeRecentFile', filePath),

  /** 将文件添加到最近文件列表顶部（用于切换已打开文件时更新排序） */
  addRecentFile: (filePath) => ipcRenderer.invoke('app:addRecentFile', filePath),

  /**
   * 检测文件编码
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, encoding?: string, error?: string}>}
   */
  detectEncoding: (filePath) => ipcRenderer.invoke('fs:detectEncoding'),

  /**
   * 验证拖拽文件路径是否有效
   * @param {string[]} filePaths - 文件路径数组
   * @returns {Promise<string[]>} 有效的文件路径数组
   */
  validateFiles: (filePaths) => ipcRenderer.invoke('fs:validateFiles', filePaths),

  // ============================================================
  // Shell 操作
  // ============================================================

  /**
   * 在系统文件管理器中打开文件所在文件夹
   * @param {string} filePath - 文件绝对路径
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  // ============================================================
  // 主进程事件监听（菜单操作等）
  // ============================================================

  /**
   * 监听主进程发送的事件
   * @param {string} channel - 事件通道名
   * @param {Function} callback - 回调函数
   */
  onMenuAction: (channel, callback) => {
    const validChannels = [
      'menu-new-file', 'menu-save', 'menu-save-as', 'menu-close-tab',
      'menu-undo', 'menu-redo', 'menu-cut', 'menu-copy', 'menu-paste',
      'menu-find', 'menu-replace', 'menu-select-all', 'menu-toggle-sidebar',
      'open-files', 'open-folder',
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    }
  },

  /**
   * 移除菜单事件监听
   * @param {string} channel - 事件通道名
   * @param {Function} callback - 回调函数
   */
  removeMenuAction: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },
})
