/**
 * src/stores/tabs.js - 标签页状态管理 (Pinia Store)
 * 
 * 管理编辑器中所有打开的文件标签页状态，包括：
 * - 标签页的增删改查
 * - 当前活动标签页的切换
 * - 文件修改状态跟踪
 * - 文件编码信息管理
 * - 大文件优化：超过阈值的大文件内容存储在非响应式 Map 中，避免性能问题
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 生成唯一 ID 的工具函数
let tabIdCounter = 0
function generateTabId() {
  return `tab_${Date.now()}_${++tabIdCounter}`
}

/**
 * 大文件阈值（2MB）
 * 超过此大小的文件将使用非响应式存储，并禁用部分编辑器功能以优化性能
 */
const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024

/**
 * 大文件内容非响应式存储
 * 使用 Map 按 tabId 存储大文件内容，避免 Vue 响应式代理大字符串
 * @type {Map<string, string>}
 */
const largeFileContents = new Map()

export const useTabsStore = defineStore('tabs', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** @type {import('vue').Ref<Array>} 所有标签页列表 */
  const tabs = ref([])

  /** @type {import('vue').Ref<string|null>} 当前活动标签页的 ID */
  const activeTabId = ref(null)

  // ============================================================
  // 计算属性
  // ============================================================

  /** 当前活动的标签页对象 */
  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value) || null
  })

  /** 标签页数量 */
  const tabCount = computed(() => tabs.value.length)

  /** 是否有未保存的修改 */
  const hasUnsavedChanges = computed(() => {
    return tabs.value.some(t => t.modified)
  })

  // ============================================================
  // 操作方法
  // ============================================================

  /**
   * 创建新的空白标签页
   * @param {string} title - 标签页标题（可选，默认 "Untitled"）
   * @returns {string} 新标签页的 ID
   */
  function createTab(title = 'Untitled') {
    const id = generateTabId()
    const untitledCount = tabs.value.filter(t => t.filePath === null).length + 1
    const tabName = title === 'Untitled' ? `Untitled-${untitledCount}` : title

    const tab = {
      id,
      title: tabName,
      filePath: null,        // 文件路径（null 表示未保存的新文件）
      content: '',           // 编辑器内容（大文件时此字段为空，内容存储在 largeFileContents 中）
      encoding: 'utf-8',     // 文件编码
      modified: false,       // 是否有未保存的修改
      language: 'plaintext', // Monaco Editor 语言模式
      isLargeFile: false,    // 是否为大文件（>2MB），大文件自动禁用高亮等重功能
      highlightEnabled: true,// 是否启用文本高亮（用户可手动切换）
      fileSize: 0,           // 文件大小（字节）
      viewState: null,       // 标签页切换前保存的编辑器滚动/光标位置
    }

    tabs.value.push(tab)
    activeTabId.value = id
    return id
  }

  /**
   * 获取标签页的实际内容
   * 普通文件从 tab.content 读取，大文件从 largeFileContents Map 读取
   * 
   * @param {string} tabId - 标签页 ID
   * @returns {string} 文件内容
   */
  function getTabContent(tabId) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return ''
    if (tab.isLargeFile) {
      return largeFileContents.get(tabId) || ''
    }
    return tab.content || ''
  }

  /**
   * 设置标签页内容
   * 普通文件写入 tab.content（响应式），大文件写入 largeFileContents Map（非响应式）
   * 
   * @param {string} tabId - 标签页 ID
   * @param {string} content - 文件内容
   */
  function setTabContent(tabId, content) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return
    if (tab.isLargeFile) {
      largeFileContents.set(tabId, content)
    } else {
      tab.content = content
    }
  }

  /**
   * 打开文件标签页
   * 如果文件已经打开，则切换到该标签页
   * 自动检测文件大小，对大文件启用优化策略
   * 
   * @param {string} filePath - 文件绝对路径
   * @param {string} content - 文件内容
   * @param {string} encoding - 文件编码
   * @param {number} [fileSize=0] - 文件大小（字节），用于大文件判断
   * @returns {string} 标签页 ID
   */
  function openFileTab(filePath, content, encoding = 'utf-8', fileSize = 0) {
    // 检查文件是否已打开
    const existingTab = tabs.value.find(t => t.filePath === filePath)
    if (existingTab) {
      activeTabId.value = existingTab.id
      return existingTab.id
    }

    const id = generateTabId()
    const fileName = filePath.split(/[/\\]/).pop()
    
    // 大文件检测（>2MB）：内容存非响应式 Map，编辑器自动禁用高亮等重功能
    // fileSize 由主进程通过 fs.statSync 提供，无需在渲染进程重复计算避免阻塞
    const actualSize = fileSize > 0 ? fileSize : (content ? content.length : 0)
    const isLarge = actualSize > LARGE_FILE_THRESHOLD
    
    // 始终检测文件对应的语言模式，语法高亮在编辑器中根据 highlightEnabled 控制
    const language = detectLanguage(fileName)

    const tab = {
      id,
      title: fileName,
      filePath,
      content: isLarge ? '' : content,   // 大文件内容存非响应式 Map
      encoding,
      modified: false,
      language,
      isLargeFile: isLarge,
      highlightEnabled: !isLarge,        // 大文件默认关闭高亮，小文件默认开启
      fileSize: actualSize,
      viewState: null,                   // 标签页切换前保存的编辑器滚动/光标位置
    }

    // 大文件内容存储到非响应式 Map
    if (isLarge) {
      largeFileContents.set(id, content)
    }

    tabs.value.push(tab)
    activeTabId.value = id
    return id
  }

  /**
   * 关闭标签页
   * 如果关闭的是活动标签页，自动切换到相邻标签页
   * 同时清理大文件内容缓存
   * 
   * @param {string} tabId - 要关闭的标签页 ID
   * @returns {boolean} 是否成功关闭
   */
  function closeTab(tabId) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return false

    // 清理大文件内容缓存
    if (largeFileContents.has(tabId)) {
      largeFileContents.delete(tabId)
    }

    tabs.value.splice(index, 1)

    // 如果关闭的是当前活动标签页，切换活动标签页
    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        // 优先切换到右侧标签页，否则切换到左侧
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }

    return true
  }

  /**
   * 切换活动标签页
   * @param {string} tabId - 目标标签页 ID
   */
  function setActiveTab(tabId) {
    if (tabs.value.some(t => t.id === tabId)) {
      activeTabId.value = tabId
    }
  }

  /**
   * 根据文件路径查找已打开的标签页并切换
   * 用于侧边栏点击已打开文件时快速切换，避免不必要的 IPC 文件读取
   * 
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否找到并切换成功
   */
  function activateTabByPath(filePath) {
    const existingTab = tabs.value.find(t => t.filePath === filePath)
    if (existingTab) {
      activeTabId.value = existingTab.id
      return true
    }
    return false
  }

  /**
   * 更新标签页内容
   * 自动路由到大文件或普通存储
   * 
   * @param {string} tabId - 标签页 ID
   * @param {string} content - 新内容
   */
  function updateTabContent(tabId, content) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      if (tab.isLargeFile) {
        largeFileContents.set(tabId, content)
      } else {
        tab.content = content
      }
      tab.modified = true
    }
  }

  /**
   * 标记标签页已保存
   * @param {string} tabId - 标签页 ID
   * @param {string} [filePath] - 保存后的文件路径（另存为时更新）
   * @param {string} [encoding] - 保存使用的编码
   */
  function markTabSaved(tabId, filePath, encoding) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.modified = false
      if (filePath) {
        tab.filePath = filePath
        tab.title = filePath.split(/[/\\]/).pop()
        tab.language = detectLanguage(tab.title)
      }
      if (encoding) {
        tab.encoding = encoding
      }
    }
  }

  /**
   * 更新标签页的编码设置
   * @param {string} tabId - 标签页 ID
   * @param {string} encoding - 新编码
   */
  function updateTabEncoding(tabId, encoding) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) {
      tab.encoding = encoding
    }
  }

  /**
   * 切换当前标签页的高亮状态
   * 使用 highlightVersion 计数器确保跨组件响应式更新可靠触发
   */
  const highlightVersion = ref(0)

  function toggleHighlight() {
    const tab = tabs.value.find(t => t.id === activeTabId.value)
    if (tab) {
      tab.highlightEnabled = !tab.highlightEnabled
      highlightVersion.value++
    }
  }

  /**
   * 关闭所有标签页
   * 同时清理所有大文件内容缓存
   */
  function closeAllTabs() {
    // 清理所有大文件内容缓存
    largeFileContents.clear()
    tabs.value = []
    activeTabId.value = null
  }

  /**
   * 关闭其他标签页（保留指定标签页）
   * @param {string} tabId - 要保留的标签页 ID
   */
  function closeOtherTabs(tabId) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return
    // 清理被关闭标签页的大文件缓存
    for (let i = tabs.value.length - 1; i >= 0; i--) {
      if (i !== index) {
        if (largeFileContents.has(tabs.value[i].id)) {
          largeFileContents.delete(tabs.value[i].id)
        }
        tabs.value.splice(i, 1)
      }
    }
    activeTabId.value = tabId
  }

  /**
   * 关闭左侧所有标签页（保留指定标签页及其右侧）
   * @param {string} tabId - 参考标签页 ID
   */
  function closeLeftTabs(tabId) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index <= 0) return
    // 从右往左删除 index 之前的标签页
    for (let i = index - 1; i >= 0; i--) {
      if (largeFileContents.has(tabs.value[i].id)) {
        largeFileContents.delete(tabs.value[i].id)
      }
      tabs.value.splice(i, 1)
    }
    // 当前 tab 仍在活动状态则保持不变，否则更新
    if (tabs.value.length > 0) {
      activeTabId.value = tabs.value[0].id === tabId ? tabId : (tabs.value.find(t => t.id === tabId)?.id || tabs.value[0].id)
    }
  }

  /**
   * 关闭右侧所有标签页（保留指定标签页及其左侧）
   * @param {string} tabId - 参考标签页 ID
   */
  function closeRightTabs(tabId) {
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1 || index >= tabs.value.length - 1) return
    // 从右往左删除 index 之后的标签页
    for (let i = tabs.value.length - 1; i > index; i--) {
      if (largeFileContents.has(tabs.value[i].id)) {
        largeFileContents.delete(tabs.value[i].id)
      }
      tabs.value.splice(i, 1)
    }
    // 保持当前活动标签
    if (!tabs.value.find(t => t.id === activeTabId.value)) {
      activeTabId.value = tabId
    }
  }

  /**
   * 根据文件名检测 Monaco Editor 语言模式
   * @param {string} fileName - 文件名
   * @returns {string} Monaco Editor 语言标识
   */
  function detectLanguage(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const languageMap = {
      js: 'javascript', jsx: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      vue: 'html', svelte: 'html',
      html: 'html', htm: 'html',
      css: 'css', scss: 'scss', less: 'less',
      json: 'json',
      xml: 'xml', svg: 'xml',
      md: 'markdown', markdown: 'markdown',
      py: 'python',
      java: 'java',
      c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      sql: 'sql',
      sh: 'shell', bash: 'shell', zsh: 'shell',
      bat: 'bat', ps1: 'powershell',
      yaml: 'yaml', yml: 'yaml',
      toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
      txt: 'plaintext', log: 'plaintext',
    }
    return languageMap[ext] || 'plaintext'
  }

  return {
    // 状态
    tabs,
    activeTabId,
    highlightVersion,
    // 计算属性
    activeTab,
    tabCount,
    hasUnsavedChanges,
    // 方法
    createTab,
    openFileTab,
    closeTab,
    setActiveTab,
    activateTabByPath,
    getTabContent,
    setTabContent,
    updateTabContent,
    markTabSaved,
    updateTabEncoding,
    toggleHighlight,
    closeAllTabs,
    closeOtherTabs,
    closeLeftTabs,
    closeRightTabs,
    // 常量
    LARGE_FILE_THRESHOLD,
  }
})
