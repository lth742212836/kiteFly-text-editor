<!--
  StatusBar.vue - 状态栏组件
  
  显示编辑器当前状态信息：
  - 光标位置（行号、列号）
  - 文件编码
  - 语言模式
  - 缩进设置
-->
<template>
  <div class="status-bar">
    <!-- 左侧状态信息 -->
    <div class="status-left">
      <!-- 光标位置 -->
      <span class="status-item" v-if="cursorPosition">
        行 {{ cursorPosition.line }}, 列 {{ cursorPosition.column }}
      </span>

      <!-- 文件编码 -->
      <span class="status-item" v-if="tabsStore.activeTab">
        {{ tabsStore.activeTab.encoding.toUpperCase() }}
      </span>

      <!-- 语言模式 -->
      <span class="status-item" v-if="tabsStore.activeTab">
        {{ tabsStore.activeTab.language }}
      </span>

      <!-- 缩进设置 -->
      <span class="status-item" v-if="tabsStore.activeTab">
        空格: {{ tabSize }}
      </span>
    </div>

    <!-- 右侧状态信息 -->
    <div class="status-right">
      <!-- 文件修改状态 -->
      <span class="status-item" v-if="tabsStore.activeTab?.modified">
        ● 已修改
      </span>

      <!-- 文件路径 -->
      <span class="status-item file-path" v-if="tabsStore.activeTab?.filePath" :title="tabsStore.activeTab.filePath">
        {{ tabsStore.activeTab.filePath }}
      </span>
    </div>
  </div>
</template>

<script setup>
/**
 * StatusBar.vue - 状态栏组件逻辑
 * 
 * 通过 inject 获取编辑器实例，监听光标位置变化并更新显示。
 */
import { ref, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import { useTabsStore } from '@/stores/tabs'

const tabsStore = useTabsStore()

// 从 EditorPanel 注入编辑器引用
const editorRef = inject('editorRef', null)

// 光标位置
const cursorPosition = ref({ line: 1, column: 1 })
const tabSize = ref(4)

let cursorListener = null

onMounted(() => {
  // 监听标签页切换，重新附加编辑器事件
  watch(
    () => tabsStore.activeTabId,
    () => {
      // 延迟等待编辑器更新
      setTimeout(attachEditorListener, 200)
    }
  )
  // 初始附加
  setTimeout(attachEditorListener, 500)
})

onBeforeUnmount(() => {
  if (cursorListener) {
    cursorListener.dispose()
    cursorListener = null
  }
})

/**
 * 附加编辑器事件监听器
 * 通过 inject 获取的编辑器引用监听光标变化
 */
function attachEditorListener() {
  const editor = editorRef?.value
  if (!editor) return

  // 更新当前光标位置
  const position = editor.getPosition()
  if (position) {
    cursorPosition.value = { line: position.lineNumber, column: position.column }
  }

  // 获取缩进设置
  try {
    const options = editor.getOptions()
    const rawOptions = options._options
    tabSize.value = (rawOptions && rawOptions.tabSize) ? rawOptions.tabSize.value : 4
  } catch (e) {
    tabSize.value = 4
  }

  // 移除旧监听器
  if (cursorListener) {
    cursorListener.dispose()
  }

  // 监听光标变化
  cursorListener = editor.onDidChangeCursorPosition((e) => {
    cursorPosition.value = { line: e.position.lineNumber, column: e.position.column }
  })
}
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--statusbar-height);
  background: var(--accent);
  padding: 0 12px;
  font-size: 12px;
  flex-shrink: 0;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-item {
  padding: 0 8px;
  color: #ffffff;
  white-space: nowrap;
  font-size: 12px;
}

.status-item.file-path {
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
}
</style>
