<!--
  EditorPanel.vue - 编辑器面板组件
  
  核心编辑区域，集成 Monaco Editor。
  负责：
  - 编辑器实例管理
  - 文件内容的加载与保存
  - 编码处理
  - 撤销/重做操作
-->
<template>
  <div class="editor-panel">
    <!-- 无标签页时的欢迎页面 -->
    <div v-if="!tabsStore.activeTab" class="welcome-page">
      <div class="welcome-content">
        <h1 class="welcome-title">TxtEdit</h1>
        <p class="welcome-subtitle">轻量级跨平台文本编辑器</p>
        <div class="welcome-shortcuts">
          <div class="shortcut-item">
            <kbd>Ctrl+N</kbd> 新建文件
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+O</kbd> 打开文件
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+S</kbd> 保存文件
          </div>
        </div>
      </div>
    </div>

    <!-- 大文件加载进度条 -->
    <div v-if="loadingLargeFile" class="loading-overlay">
      <div class="loading-box">
        <p class="loading-title">正在加载大文件...</p>
        <p class="loading-filename">{{ loadingFileName }}</p>
        <p class="loading-size">{{ loadingFileSize }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
        </div>
        <p class="loading-percent">{{ loadingProgress }}%</p>
      </div>
    </div>

    <!-- Monaco Editor 容器 -->
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script setup>
/**
 * EditorPanel.vue - 编辑器面板逻辑
 * 
 * 管理 Monaco Editor 实例的生命周期：
 * 创建、切换标签页、销毁编辑器。
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick, provide } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSidebarStore } from '@/stores/sidebar'
import { useThemeStore, THEMES } from '@/stores/theme'
import * as monaco from 'monaco-editor'

const tabsStore = useTabsStore()
const sidebarStore = useSidebarStore()
const themeStore = useThemeStore()

// 通过 provide 将编辑器实例和 monaco 实例共享给子组件（FindReplacePanel, StatusBar）
provide('monacoInstance', monaco)
const editorRef = ref(null)
provide('editorRef', editorRef)

// DOM 引用
const editorContainer = ref(null)

// Monaco Editor 实例
let editor = null

// 编辑器内容变化监听器
let contentChangeListener = null

// ResizeObserver 用于监听容器大小变化
let resizeObserver = null

// 大文件防抖定时器：避免频繁同步内容
let largeFileSyncTimer = null
const LARGE_FILE_SYNC_INTERVAL = 2000 // 大文件内容同步间隔（2秒）

// 大文件加载进度状态
const loadingLargeFile = ref(false)
const loadingProgress = ref(0)
const loadingFileName = ref('')
const loadingFileSize = ref('')

// ============================================================
// 自定义 Monaco 主题注册
// ============================================================

/**
 * 注册自定义 Monaco Editor 主题
 * - eye-care: 护眼绿背景主题
 */
function registerCustomThemes() {
  // 护眼主题：浅绿色背景，深色文字
  monaco.editor.defineTheme('eye-care', {
    base: 'vs', // 基于亮色主题
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#c7edcc',
      'editor.foreground': '#2d4a32',
      'editor.lineHighlightBackground': '#b8e6c0',
      'editor.selectionBackground': '#8ecf9866',
      'editorCursor.foreground': '#2d4a32',
      'editorLineNumber.foreground': '#7a9a7e',
      'editorLineNumber.activeForeground': '#2d4a32',
      'editor.inactiveSelectionBackground': '#8ecf9840',
      'editorWidget.background': '#d4f0d8',
      'editorWidget.border': '#a8dbb0',
      'input.background': '#ffffff',
      'input.foreground': '#2d4a32',
      'input.border': '#a8dbb0',
      'focusBorder': '#4a9d5a',
    },
  })
}

// 在模块加载时注册自定义主题
registerCustomThemes()

/**
 * 格式化文件大小为可读字符串
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * 获取当前主题对应的 Monaco Editor 主题名
 * @returns {string} Monaco 主题名 ('vs-dark' | 'vs')
 */
function getMonacoTheme() {
  const theme = THEMES.find(t => t.id === themeStore.current)
  return theme ? theme.monacoTheme : 'vs-dark'
}

/**
 * 处理窗口 resize 事件
 * 通知 Monaco Editor 重新计算布局
 */
function handleResize() {
  if (editor) {
    editor.layout()
  }
}

// Monaco Editor 基础配置（不含 theme，theme 在 updateEditorContent 中动态设置）
const baseEditorOptions = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
  lineNumbers: 'on',
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  wordWrap: 'off',
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: true,
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: true },
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  formatOnPaste: true,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  renderLineHighlight: 'all',
  lineHeight: 22,
  padding: { top: 8 },
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
    nonBasicASCII: false,
  },
}

/**
 * 根据文件大小和高亮开关获取优化的编辑器配置
 * - 小文件：始终使用完整配置
 * - 大文件 + 高亮关闭：纯文本轻量模式
 * - 大文件 + 高亮开启：恢复完整配置（用户手动开启）
 * 
 * @param {object} tab - 标签页对象
 * @returns {object} Monaco Editor 配置
 */
function getEffectiveOptions(tab) {
  if (!tab) return baseEditorOptions

  // 小文件，或大文件但用户手动开启了高亮：使用完整配置
  if (!tab.isLargeFile || tab.highlightEnabled) {
    return baseEditorOptions
  }

  // 大文件且高亮关闭：纯文本模式，禁用所有高亮和重功能以保证性能
  return {
    ...baseEditorOptions,
    minimap: { enabled: false },
    lineNumbers: 'on',
    renderWhitespace: 'none',
    bracketPairColorization: { enabled: false },
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    formatOnPaste: false,
    smoothScrolling: false,
    cursorSmoothCaretAnimation: 'off',
    renderLineHighlight: 'none',
    wordWrap: 'on',
    folding: false,
    renderIndentGuides: false,
    occurrencesHighlight: false,
    selectionHighlight: false,
    glyphMargin: false,
    lineDecorationsWidth: 0,
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
  }
}

// 记录上一次活动的 tabId，用于在切换时保存 viewState
let previousActiveTabId = null

onMounted(() => {
  // 初始化 Monaco Editor（nextTick 确保 DOM 渲染完成）
  nextTick(() => {
    initEditor()
  })

  // 监听窗口大小变化，重新布局编辑器
  window.addEventListener('resize', handleResize)

  // 监听活动标签页切换
  watch(
    () => tabsStore.activeTabId,
    (newTabId, oldTabId) => {
      // 切换前：保存当前标签页的编辑器状态（滚动位置、光标位置）
      if (editor && oldTabId && tabsStore.tabs.length > 0) {
        const oldTab = tabsStore.tabs.find(t => t.id === oldTabId)
        if (oldTab) {
          oldTab.viewState = editor.saveViewState()
        }
      }
      previousActiveTabId = oldTabId
      nextTick(() => updateEditorContent())
    }
  )

  // 监听主题切换，同步更新 Monaco Editor 主题
  watch(
    () => themeStore.current,
    () => {
      if (editor) {
        editor.updateOptions({ theme: getMonacoTheme() })
      }
    }
  )

  // 监听高亮开关切换，更新语法高亮语言模式和编辑器选项
  watch(
    () => tabsStore.highlightVersion,
    () => {
      if (!editor || !tabsStore.activeTab) return
      const tab = tabsStore.activeTab
      const model = editor.getModel()
      if (model) {
        // 高亮开启：使用文件对应的语言模式；高亮关闭：切换为纯文本
        const language = tab.highlightEnabled ? (tab.language || 'plaintext') : 'plaintext'
        monaco.editor.setModelLanguage(model, language)
      }
      const options = getEffectiveOptions(tab)
      editor.updateOptions(options)
    }
  )
})

onBeforeUnmount(() => {
  // 移除 resize 监听
  window.removeEventListener('resize', handleResize)
  
  // 断开 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  // 清除大文件同步定时器
  if (largeFileSyncTimer) {
    clearTimeout(largeFileSyncTimer)
    largeFileSyncTimer = null
  }

  // 销毁编辑器实例
  if (editor) {
    editor.dispose()
    editor = null
  }
})

/**
 * 初始化 Monaco Editor 实例
 * 使用 ResizeObserver 监听容器尺寸变化自动重新布局
 */
function initEditor() {
  if (!editorContainer.value) return

  // 确保容器已有明确尺寸后再创建编辑器
  const rect = editorContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    // 容器尚未就绪，延迟重试
    setTimeout(() => initEditor(), 50)
    return
  }

  // 根据当前活动标签页获取优化的编辑器配置
  const options = getEffectiveOptions(tabsStore.activeTab)

  editor = monaco.editor.create(editorContainer.value, {
    ...options,
    value: '',
    language: 'plaintext',
  })

  // 更新共享的编辑器引用
  editorRef.value = editor

  // 使用 ResizeObserver 监听容器大小变化，自动触发布局更新
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (editor) {
        editor.layout()
      }
    })
    resizeObserver.observe(editorContainer.value)
  }

  // 监听内容变化，同步到 store
  // 小文件实时同步；大文件使用防抖减少同步频率，避免频繁操作大字符串
  contentChangeListener = editor.onDidChangeModelContent(() => {
    if (!tabsStore.activeTabId) return
    const tab = tabsStore.activeTab
    if (tab?.isLargeFile) {
      // 大文件：防抖同步，避免每次按键都操作大字符串
      if (largeFileSyncTimer) clearTimeout(largeFileSyncTimer)
      largeFileSyncTimer = setTimeout(() => {
        const value = editor.getValue()
        tabsStore.updateTabContent(tabsStore.activeTabId, value)
      }, LARGE_FILE_SYNC_INTERVAL)
    } else {
      const value = editor.getValue()
      tabsStore.updateTabContent(tabsStore.activeTabId, value)
    }
  })
}

/**
 * 根据当前活动标签页更新编辑器内容
 * 切换标签页后需要触发布局更新确保编辑器填满容器
 * 大文件使用分片加载 + 进度条，避免 Monaco setValue 阻塞 UI
 */
async function updateEditorContent() {
  if (!editor) {
    initEditor()
  }
  // 所有标签页已关闭：清空编辑器内容
  if (!editor || !tabsStore.activeTab) {
    if (editor) {
      const model = editor.getModel()
      if (model) {
        model.setValue('')
      }
    }
    return
  }

  const tab = tabsStore.activeTab

  // 获取内容（大文件从非响应式 Map 读取）
  const content = tabsStore.getTabContent(tab.id)

  // 更新编辑器模型的语言和值
  const model = editor.getModel()
  if (model) {
    // 大文件优化：先应用轻量配置，再设置内容
    if (tab.isLargeFile && !tab.highlightEnabled) {
      const lightOptions = getEffectiveOptions(tab)
      editor.updateOptions(lightOptions)
    }

    // 根据高亮开关决定语言模式
    const language = tab.highlightEnabled ? (tab.language || 'plaintext') : 'plaintext'
    monaco.editor.setModelLanguage(model, language)

    if (tab.isLargeFile) {
      // 大文件：分片加载 + 进度条（先设置 loading 状态，让进度条先渲染）
      loadingLargeFile.value = true
      loadingFileName.value = tab.title
      loadingFileSize.value = `${formatFileSize(tab.fileSize)}`
      loadingProgress.value = 0
      await loadLargeFileContent(model, content, tab)
      loadingLargeFile.value = false
    } else {
      model.setValue(content)
    }

    // 大文件设置完内容后再更新剩余选项
    if (tab.isLargeFile && tab.highlightEnabled) {
      const fullOptions = getEffectiveOptions(tab)
      editor.updateOptions(fullOptions)
    } else if (!tab.isLargeFile) {
      const options = getEffectiveOptions(tab)
      editor.updateOptions(options)
    }
  }

  // 确保当前主题正确应用（防止 baseEditorOptions 中的旧 theme 覆盖）
  editor.updateOptions({ theme: getMonacoTheme() })

  // 清除大文件同步定时器
  if (largeFileSyncTimer) {
    clearTimeout(largeFileSyncTimer)
    largeFileSyncTimer = null
  }

  // 内容更新后触发重新布局，确保编辑器填满容器
  editor.layout()

  // 恢复之前保存的编辑器状态（滚动位置、光标位置）
  if (tab.viewState) {
    editor.restoreViewState(tab.viewState)
  }
}

/**
 * 分片加载大文件内容到编辑器，显示进度条
 * 
 * 优化策略：
 * 1. 立即显示进度条（不等待任何预处理）
 * 2. 使用 indexOf 逐行扫描替代 split，避免创建数百万字符串的内存开销
 * 3. 分片写入，每片之间给 UI 渲染帧
 * 
 * @param {monaco.editor.ITextModel} model - 编辑器模型
 * @param {string} content - 文件内容
 * @param {object} tab - 标签页对象
 */
async function loadLargeFileContent(model, content, tab) {
  // 等待 Vue 渲染进度条 DOM（loadingLargeFile 已在调用方 openFiles 设置为 true）
  await nextTick()

  const contentLength = content.length

  // 小文件（< 5MB）一次性设置，不需要分片
  if (contentLength < 5 * 1024 * 1024) {
    model.setValue(content)
    return
  }

  // 进度条已可见，清空模型准备分片写入
  model.setValue('')

  // 使用 Promise + requestAnimationFrame 分片扫描并写入
  // 边扫描边写入，避免 split 一次性创建所有行数组
  return new Promise((resolve) => {
    const CHUNK_SIZE = 5000 // 每片处理 5000 行
    let cursor = 0
    let chunkIndex = 0
    let lineCount = 0
    const len = contentLength

    function processChunk() {
      const chunkStart = cursor
      let linesInChunk = 0

      // 扫描当前片，找到 CHUNK_SIZE 行或到达末尾
      while (cursor < len && linesInChunk < CHUNK_SIZE) {
        const nextLF = content.indexOf('\n', cursor)
        if (nextLF === -1) {
          cursor = len
        } else {
          cursor = nextLF + 1
        }
        linesInChunk++
        lineCount++
      }

      const chunkText = content.slice(chunkStart, cursor)

      // 第一个分片用 setValue，后续用 applyEdits 追加
      if (chunkIndex === 0) {
        model.setValue(chunkText)
      } else {
        const lastLine = model.getLineCount()
        const lastCol = model.getLineMaxColumn(lastLine)
        model.applyEdits([{
          range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
          text: chunkText,
        }])
      }

      chunkIndex++

      // 更新进度：基于已处理的字节数
      loadingProgress.value = Math.round((cursor / len) * 100)
      // 动态更新行数信息
      loadingFileSize.value = `${lineCount.toLocaleString()} 行 · ${formatFileSize(tab.fileSize)}`

      if (cursor < len) {
        requestAnimationFrame(processChunk)
      } else {
        // 完成
        resolve()
      }
    }

    requestAnimationFrame(processChunk)
  })
}

/**
 * 打开文件（支持批量）
 * 已打开的文件直接切换标签页（跳过 IPC），未打开的文件先预检大小
 * 超大文件（>50MB）弹出确认提示，大文件（>2MB）自动启用优化策略
 * 
 * @param {string[]} filePaths - 文件路径数组
 */
async function openFiles(filePaths) {
  const entries = await window.electronAPI.validateFiles(filePaths)
  if (entries.length === 0) return

  for (const { path: filePath } of entries) {
    try {
      // 优先检查文件是否已在标签页中打开，已打开则直接切换（跳过 IPC）
      // activateTabByPath 会触发 watch 自动调用 updateEditorContent
      if (tabsStore.activateTabByPath(filePath)) {
        // 已打开的文件也需要更新最近文件排序
        await window.electronAPI.addRecentFile(filePath)
        continue
      }

      // 文件未打开，通过 IPC 读取文件内容
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        // 大文件预检测：在 openFileTab 之前判断，提前显示进度条
        const isLarge = result.fileSize > 2 * 1024 * 1024

        if (isLarge) {
          // 大文件：先显示进度条（不阻塞 UI），再创建 tab 和加载内容
          loadingLargeFile.value = true
          loadingFileName.value = filePath.split(/[/\\]/).pop()
          loadingFileSize.value = `${formatFileSize(result.fileSize)}`
          loadingProgress.value = 0
        }

        // 创建标签页（大文件内容不放入响应式 store）
        tabsStore.openFileTab(filePath, result.content, result.encoding, result.fileSize)

        // 等待 Vue 响应式更新完成，确保进度条 DOM 渲染
        await nextTick()

        if (isLarge) {
          // 大文件：初始化编辑器后分片加载内容
          if (!editor) initEditor()
          if (editor && tabsStore.activeTab) {
            const model = editor.getModel()
            if (model) {
              const tab = tabsStore.activeTab
              const language = tab.highlightEnabled ? (tab.language || 'plaintext') : 'plaintext'
              monaco.editor.setModelLanguage(model, language)
              if (tab.isLargeFile && !tab.highlightEnabled) {
                editor.updateOptions(getEffectiveOptions(tab))
              }
              // 分片加载（内部会先 await nextTick 确保进度条可见）
              const content = tabsStore.getTabContent(tab.id)
              await loadLargeFileContent(model, content, tab)
            }
          }
          loadingLargeFile.value = false
        } else {
          // 小文件：正常加载
          updateEditorContent()
        }
      } else {
        console.error('读取文件失败:', result.error)
      }
    } catch (e) {
      console.error('打开文件异常:', e)
    }
  }

  // 刷新侧边栏最近文件列表，确保新打开的文件即时显示
  sidebarStore.loadRecentFiles()
}

/**
 * 保存当前文件
 * 如果文件已有路径则直接保存，否则弹出另存为对话框
 * 大文件从编辑器直接获取最新内容（防抖同步可能尚未更新 store）
 */
async function saveCurrentFile() {
  const tab = tabsStore.activeTab
  if (!tab) return

  if (tab.filePath) {
    // 已有文件路径，直接保存
    // 大文件从编辑器获取最新内容，避免防抖同步延迟导致数据丢失
    const content = editor ? editor.getValue() : tabsStore.getTabContent(tab.id)
    const result = await window.electronAPI.writeFile(tab.filePath, content, tab.encoding)
    if (result.success) {
      tabsStore.markTabSaved(tab.id)
    } else {
      console.error('保存失败:', result.error)
    }
  } else {
    // 新文件，弹出另存为对话框
    await saveCurrentFileAs()
  }
}

/**
 * 另存为当前文件
 * 大文件从编辑器直接获取最新内容
 */
async function saveCurrentFileAs() {
  const tab = tabsStore.activeTab
  if (!tab) return

  const savePath = await window.electronAPI.saveFileDialog(tab.filePath || tab.title)
  if (!savePath) return

  // 大文件从编辑器获取最新内容，避免防抖同步延迟导致数据丢失
  const content = editor ? editor.getValue() : tabsStore.getTabContent(tab.id)
  const result = await window.electronAPI.writeFile(savePath, content, tab.encoding)
  if (result.success) {
    tabsStore.markTabSaved(tab.id, savePath)
  } else {
    console.error('保存失败:', result.error)
  }
}

/**
 * 撤销操作
 */
function undo() {
  editor?.trigger('keyboard', 'undo', null)
}

/**
 * 重做操作
 */
function redo() {
  editor?.trigger('keyboard', 'redo', null)
}

/**
 * 获取编辑器中当前选中的文本
 * @returns {string} 选中的文本，无选中时返回空字符串
 */
function getSelectedText() {
  if (!editor) return ''
  const selection = editor.getSelection()
  if (!selection || selection.isEmpty()) return ''
  const model = editor.getModel()
  return model ? model.getValueInRange(selection) : ''
}

// 暴露方法给父组件
defineExpose({
  openFiles,
  saveCurrentFile,
  saveCurrentFileAs,
  undo,
  redo,
  getSelectedText,
})
</script>

<style scoped>
.editor-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--bg-primary);
}

.welcome-content {
  text-align: center;
}

.welcome-title {
  font-size: 42px;
  font-weight: 200;
  color: var(--text-primary);
  letter-spacing: 6px;
  margin-bottom: 6px;
  opacity: 0.85;
}

.welcome-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 28px;
  opacity: 0.6;
}

.welcome-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.shortcut-item {
  font-size: 12px;
  color: var(--text-muted);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  margin-right: 6px;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

/* 大文件加载进度条覆盖层 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 30, 30, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-box {
  text-align: center;
  padding: 36px 48px;
  background: var(--bg-secondary, #252526);
  border: 1px solid var(--border-color, #3c3c3c);
  border-radius: 8px;
  min-width: 360px;
}

.loading-title {
  font-size: 16px;
  color: var(--text-primary, #cccccc);
  margin: 0 0 10px 0;
  font-weight: 500;
}

.loading-filename {
  font-size: 13px;
  color: var(--accent, #007acc);
  margin: 0 0 4px 0;
  word-break: break-all;
}

.loading-size {
  font-size: 11px;
  color: var(--text-muted, #888888);
  margin: 0 0 20px 0;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-input, #3c3c3c);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: var(--accent, #007acc);
  border-radius: 3px;
  transition: width 0.15s ease;
  min-width: 0;
}

.loading-percent {
  font-size: 12px;
  color: var(--text-secondary, #999999);
  margin: 0;
}
</style>
