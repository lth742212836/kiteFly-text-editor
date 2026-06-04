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

      <!-- 文件编码（可交互下拉选择） -->
      <span class="status-item" v-if="tabsStore.activeTab">
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
      </span>

      <!-- 语言模式 -->
      <span class="status-item" v-if="tabsStore.activeTab">
        {{ tabsStore.activeTab.language }}
      </span>

      <!-- 缩进设置 -->
      <span class="status-item" v-if="tabsStore.activeTab">
        空格: {{ tabSize }}
      </span>

      <!-- 高亮开关 -->
      <span
        class="status-item highlight-toggle"
        :class="{ 'highlight-off': !tabsStore.activeTab?.highlightEnabled }"
        v-if="tabsStore.activeTab"
        @click="tabsStore.toggleHighlight()"
        :title="tabsStore.activeTab?.highlightEnabled ? '点击关闭文本高亮' : '点击开启文本高亮'"
      >
        {{ tabsStore.activeTab?.highlightEnabled ? '✦ 高亮 开' : '✧ 高亮 关' }}
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

/**
 * 编码切换处理
 * @param {string} encoding - 新编码
 */
function onEncodingChange(encoding) {
  if (tabsStore.activeTabId) {
    tabsStore.updateTabEncoding(tabsStore.activeTabId, encoding)
  }
}
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--statusbar-height);
  background: var(--accent);
  padding: 0 10px;
  font-size: 11px;
  flex-shrink: 0;
  user-select: none;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 0;
}

.status-item {
  padding: 0 8px;
  color: var(--status-text);
  white-space: nowrap;
  font-size: 11px;
  opacity: 0.85;
}

.status-item.file-path {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.65;
}

.encoding-select {
  padding: 0 4px;
  border: none;
  border-radius: 3px;
  background: var(--encoding-select-bg);
  color: var(--encoding-select-color);
  font-size: 11px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  padding-right: 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23333333' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 2px center;
}

.encoding-select:hover {
  background: var(--encoding-select-hover);
}

.encoding-select option {
  background: #ffffff;
  color: #333333;
}

.highlight-toggle {
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 0.15s;
}

.highlight-toggle:hover {
  opacity: 1;
}

.highlight-toggle.highlight-off {
  opacity: 0.5;
}

.highlight-toggle.highlight-off:hover {
  opacity: 0.8;
}
</style>
