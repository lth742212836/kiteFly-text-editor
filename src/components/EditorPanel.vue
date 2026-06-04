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

    <!-- 编码选择器（仅在有活动标签页时显示） -->

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
import * as monaco from 'monaco-editor'

const tabsStore = useTabsStore()
const sidebarStore = useSidebarStore()

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

/**
 * 处理窗口 resize 事件
 * 通知 Monaco Editor 重新计算布局
 */
function handleResize() {
  if (editor) {
    editor.layout()
  }
}

// Monaco Editor 基础配置
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
  theme: 'vs-dark',
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
    () => {
      nextTick(() => updateEditorContent())
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
  contentChangeListener = editor.onDidChangeModelContent(() => {
    if (tabsStore.activeTabId) {
      const value = editor.getValue()
      tabsStore.updateTabContent(tabsStore.activeTabId, value)
    }
  })
}

/**
 * 根据当前活动标签页更新编辑器内容
 * 切换标签页后需要触发布局更新确保编辑器填满容器
 * 大文件使用非响应式内容存储，避免 Vue 响应式系统开销
 */
function updateEditorContent() {
  if (!editor) {
    initEditor()
  }
  if (!editor || !tabsStore.activeTab) return

  const tab = tabsStore.activeTab

  // 大文件：先应用轻量配置再 setValue，避免 Monaco 全量渲染卡死
  const options = getEffectiveOptions(tab)
  editor.updateOptions(options)

  // 获取内容（大文件从非响应式 Map 读取）
  const content = tabsStore.getTabContent(tab.id)

  // 更新编辑器模型的语言和值
  const model = editor.getModel()
  if (model) {
    // 根据高亮开关决定语言模式：关闭时强制纯文本（无语法高亮），开启时使用文件对应语言
    const language = tab.highlightEnabled ? (tab.language || 'plaintext') : 'plaintext'
    monaco.editor.setModelLanguage(model, language)
    model.setValue(content)
  }

  // 内容更新后触发重新布局，确保编辑器填满容器
  editor.layout()
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
      if (tabsStore.activateTabByPath(filePath)) {
        await nextTick()
        updateEditorContent()
        continue
      }

      // 文件未打开，通过 IPC 读取文件内容
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        tabsStore.openFileTab(filePath, result.content, result.encoding, result.fileSize)
        await nextTick()
        updateEditorContent()
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
 * 大文件从编辑器直接获取内容
 */
async function saveCurrentFile() {
  const tab = tabsStore.activeTab
  if (!tab) return

  if (tab.filePath) {
    // 已有文件路径，直接保存
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
 * 大文件从编辑器直接获取内容
 */
async function saveCurrentFileAs() {
  const tab = tabsStore.activeTab
  if (!tab) return

  const savePath = await window.electronAPI.saveFileDialog(tab.filePath || tab.title)
  if (!savePath) return

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

// 暴露方法给父组件
defineExpose({
  openFiles,
  saveCurrentFile,
  saveCurrentFileAs,
  undo,
  redo,
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
</style>
