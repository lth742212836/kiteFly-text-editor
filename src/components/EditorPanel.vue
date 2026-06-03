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
    <div v-if="tabsStore.activeTab" class="encoding-bar">
      <span class="encoding-label">编码:</span>
      <select
        class="encoding-select"
        :value="tabsStore.activeTab.encoding"
        @change="onEncodingChange($event.target.value)"
      >
        <option value="utf-8">UTF-8</option>
        <option value="utf-16le">UTF-16 LE</option>
        <option value="utf-16be">UTF-16 BE</option>
        <option value="gbk">GBK / GB2312</option>
        <option value="big5">Big5</option>
        <option value="shift_jis">Shift_JIS</option>
        <option value="euc-jp">EUC-JP</option>
        <option value="euc-kr">EUC-KR</option>
        <option value="iso-8859-1">ISO-8859-1 (Latin-1)</option>
        <option value="windows-1252">Windows-1252</option>
      </select>
      <!-- 大文件提示标签 -->
      <span v-if="tabsStore.activeTab.isLargeFile" class="large-file-badge" :title="'文件大小: ' + formatFileSize(tabsStore.activeTab.fileSize)">
        {{ tabsStore.activeTab.isHugeFile ? '超大文件' : '大文件' }} {{ formatFileSize(tabsStore.activeTab.fileSize) }}
      </span>
      <span v-if="tabsStore.activeTab.filePath" class="encoding-file" :title="tabsStore.activeTab.filePath">
        {{ tabsStore.activeTab.filePath }}
      </span>
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
import * as monaco from 'monaco-editor'

const tabsStore = useTabsStore()

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
}

/**
 * 根据文件大小获取优化的编辑器配置
 * 大文件禁用语法高亮等重功能以提升性能
 * 
 * @param {object} tab - 标签页对象
 * @returns {object} Monaco Editor 配置
 */
function getEffectiveOptions(tab) {
  if (!tab || !tab.isLargeFile) return baseEditorOptions

  if (tab.isHugeFile) {
    // 超大文件 (>50MB)：纯文本模式，禁用所有重功能
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
      wordWrap: 'on',             // 开启自动换行避免超宽行渲染性能问题
      folding: false,             // 禁用代码折叠
      renderIndentGuides: false,  // 禁用缩进参考线
      occurrencesHighlight: false,// 禁用高亮匹配
      selectionHighlight: false,  // 禁用选区高亮
      glyphMargin: false,         // 禁用字形边距
      lineDecorationsWidth: 0,    // 减少行装饰宽度
      overviewRulerLanes: 0,      // 禁用概览标尺
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
    }
  }

  // 大文件 (>2MB, ≤50MB)：适度禁用部分功能
  return {
    ...baseEditorOptions,
    minimap: { enabled: false },
    renderWhitespace: 'none',
    bracketPairColorization: { enabled: false },
    smoothScrolling: false,
    cursorSmoothCaretAnimation: 'off',
    renderLineHighlight: 'line',
    folding: false,
    renderIndentGuides: false,
  }
}

/**
 * 格式化文件大小为可读字符串
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
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

  // 获取内容（大文件从非响应式 Map 读取）
  const content = tabsStore.getTabContent(tab.id)

  // 更新编辑器模型的语言和值
  const model = editor.getModel()
  if (model) {
    // 设置语言模式
    monaco.editor.setModelLanguage(model, tab.language || 'plaintext')
    // 使用 pushEditOperations 替代 setValue，大文件时减少撤销栈内存占用
    model.setValue(content)
  }

  // 根据当前标签页的文件大小动态更新编辑器选项
  const options = getEffectiveOptions(tab)
  editor.updateOptions(options)

  // 内容更新后触发重新布局，确保编辑器填满容器
  editor.layout()
}

/**
 * 打开文件（支持批量）
 * 读取文件内容并检测大文件以启用优化策略
 * 
 * @param {string[]} filePaths - 文件路径数组
 */
async function openFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      const result = await window.electronAPI.readFile(filePath)
      if (result.success) {
        const fileSize = result.fileSize || Buffer.byteLength(result.content, 'utf-8')
        tabsStore.openFileTab(filePath, result.content, result.encoding, fileSize)
        await nextTick()
        updateEditorContent()
      } else {
        console.error('读取文件失败:', result.error)
      }
    } catch (e) {
      console.error('打开文件异常:', e)
    }
  }
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

/**
 * 编码切换处理
 * @param {string} encoding - 新编码
 */
function onEncodingChange(encoding) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabEncoding(tabsStore.activeTabId, encoding)
  }
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
  opacity: 0.7;
}

.welcome-title {
  font-size: 48px;
  font-weight: 300;
  color: var(--text-primary);
  letter-spacing: 4px;
  margin-bottom: 8px;
}

.welcome-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.welcome-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.shortcut-item kbd {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  margin-right: 8px;
}

.encoding-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  user-select: none;
}

.encoding-label {
  font-size: 11px;
  color: var(--text-muted);
}

.encoding-select {
  padding: 1px 6px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 11px;
  outline: none;
  cursor: pointer;
}

.large-file-badge {
  display: inline-block;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--warning);
  color: #000;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.encoding-file {
  flex: 1;
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}
</style>
