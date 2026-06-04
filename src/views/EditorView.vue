<!--
  EditorView.vue - 编辑器主视图
  
  应用的主布局组件，整合所有子组件：
  - 工具栏 (ToolBar)
  - 标签页栏 (TabBar)
  - 侧边栏 (Sidebar)
  - 编辑器面板 (EditorPanel)
  - 查找替换面板 (FindReplacePanel)
  - 状态栏 (StatusBar)
  
  同时负责监听主进程的菜单事件并分发处理。
-->
<template>
  <div
    class="editor-view"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- 顶部工具栏 -->
    <ToolBar />

    <!-- 标签页栏 -->
    <TabBar />

    <!-- 主体区域：侧边栏 + 编辑区 -->
    <div class="main-area">
      <!-- 侧边栏（可折叠） -->
      <Sidebar v-if="sidebarStore.visible" />

      <!-- 编辑区域 -->
      <div class="editor-area">
        <!-- 查找替换面板 -->
        <FindReplacePanel
          v-if="showFindPanel"
          @close="showFindPanel = false"
        />

        <!-- 编辑器主体 -->
        <EditorPanel ref="editorPanelRef" />

        <!-- 状态栏 -->
        <StatusBar />
      </div>
    </div>

    <!-- 文件拖拽遮罩层 -->
    <Transition name="drop-fade">
      <div v-if="isDragging" class="drop-overlay">
        <div class="drop-box">
          <svg class="drop-icon" viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
          <p class="drop-text">拖拽文件到此处打开</p>
          <p class="drop-sub">支持 .txt、.md、.js 等文本文件</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
/**
 * EditorView.vue - 编辑器主视图逻辑
 * 
 * 监听主进程菜单事件，协调各子组件之间的交互。
 */
import { ref, onMounted, onBeforeUnmount, provide } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSidebarStore } from '@/stores/sidebar'
import ToolBar from '@/components/ToolBar.vue'
import TabBar from '@/components/TabBar.vue'
import Sidebar from '@/components/Sidebar.vue'
import EditorPanel from '@/components/EditorPanel.vue'
import FindReplacePanel from '@/components/FindReplacePanel.vue'
import StatusBar from '@/components/StatusBar.vue'

const tabsStore = useTabsStore()
const sidebarStore = useSidebarStore()

// 编辑器面板引用
const editorPanelRef = ref(null)

// 查找替换面板显示状态
const showFindPanel = ref(false)

// ============================================================
// 文件拖拽相关状态与处理
// ============================================================

/** 是否正在拖拽文件到窗口 */
const isDragging = ref(false)

/** 拖拽进入计数器（解决子元素触发 dragleave 的问题） */
let dragCounter = 0

/**
 * 处理拖拽进入事件
 * 当文件拖入窗口区域时显示遮罩层
 * @param {DragEvent} e
 */
function onDragEnter(e) {
  dragCounter++
  // 确保拖拽的是文件而非其他内容
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragging.value = true
  }
}

/**
 * 处理拖拽悬停事件
 * 必须 preventDefault 以允许 drop 事件触发
 * @param {DragEvent} e
 */
function onDragOver(e) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
}

/**
 * 处理拖拽离开事件
 * 使用计数器确保完全离开窗口区域时才隐藏遮罩
 * @param {DragEvent} e
 */
function onDragLeave(e) {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragging.value = false
  }
}

/**
 * 处理文件释放事件
 * 验证文件路径后调用编辑器打开文件
 * @param {DragEvent} e
 */
async function onDrop(e) {
  dragCounter = 0
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  // 从 File 对象中提取本地文件路径（Electron 环境下 File.path 可用）
  const filePaths = []
  for (const file of files) {
    if (file.path) {
      filePaths.push(file.path)
    }
  }

  if (filePaths.length === 0) return

  // 提取有效文件路径
  const validPaths = filePaths.filter(p => p)
  if (validPaths.length === 0) return

  editorPanelRef.value?.openFiles(validPaths)
}

/**
 * 注册菜单事件处理器映射表
 * 将主进程菜单操作映射到对应的处理函数
 */
const menuHandlers = {
  'menu-new-file': () => {
    tabsStore.createTab()
  },
  'menu-save': () => {
    editorPanelRef.value?.saveCurrentFile()
  },
  'menu-save-as': () => {
    editorPanelRef.value?.saveCurrentFileAs()
  },
  'menu-close-tab': () => {
    if (tabsStore.activeTabId) {
      tabsStore.closeTab(tabsStore.activeTabId)
    }
  },
  'menu-find': () => {
    showFindPanel.value = true
  },
  'menu-replace': () => {
    showFindPanel.value = true
  },
  'menu-toggle-sidebar': () => {
    sidebarStore.toggle()
  },
  // 剪切/复制/粘贴/撤销/重做/全选：使用浏览器原生行为
  // Monaco 编辑器聚焦时会自行处理，普通 input 聚焦时由 document.execCommand 兜底
  'menu-cut': () => { document.execCommand('cut') },
  'menu-copy': () => { document.execCommand('copy') },
  'menu-paste': () => { document.execCommand('paste') },
  'menu-undo': () => { document.execCommand('undo') },
  'menu-redo': () => { document.execCommand('redo') },
  'menu-select-all': () => { document.execCommand('selectAll') },
  'open-files': (filePaths) => {
    editorPanelRef.value?.openFiles(filePaths)
  },
  'open-folder': (folderPath) => {
    sidebarStore.setCurrentFolder(folderPath)
    loadFolderContents(folderPath)
  },
}

// 存储注册的回调引用，用于清理
const registeredCallbacks = []

onMounted(() => {
  // 注册所有菜单事件监听
  Object.entries(menuHandlers).forEach(([channel, handler]) => {
    window.electronAPI.onMenuAction(channel, handler)
    registeredCallbacks.push({ channel, handler })
  })

  // 加载最近文件列表
  sidebarStore.loadRecentFiles()
})

onBeforeUnmount(() => {
  // 清理事件监听
  registeredCallbacks.forEach(({ channel, handler }) => {
    window.electronAPI.removeMenuAction(channel, handler)
  })
})

/**
 * 加载文件夹内容到侧边栏
 * @param {string} folderPath - 文件夹路径
 */
async function loadFolderContents(folderPath) {
  try {
    const result = await window.electronAPI.listDir(folderPath)
    if (result.success) {
      sidebarStore.setFolderEntries(result.entries)
    }
  } catch (e) {
    console.error('加载文件夹内容失败:', e)
  }
}

// 向子组件提供编辑器面板引用
provide('editorPanelRef', editorPanelRef)
provide('showFindPanel', showFindPanel)
</script>

<style scoped>
.editor-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

/* ============================================================
   文件拖拽遮罩层样式
   ============================================================ */

.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  pointer-events: all;
}

.drop-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 64px;
  border: 3px dashed var(--accent);
  border-radius: 16px;
  background: rgba(30, 30, 30, 0.85);
  color: var(--text-primary);
  user-select: none;
}

.drop-icon {
  color: var(--accent);
  margin-bottom: 16px;
  animation: drop-bounce 0.6s ease-in-out infinite alternate;
}

@keyframes drop-bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-8px);
  }
}

.drop-text {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.drop-sub {
  font-size: 13px;
  color: var(--text-muted, #888);
  margin: 0;
}

/* 遮罩层过渡动画 */
.drop-fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.drop-fade-leave-active {
  transition: opacity 0.1s ease-in;
}

.drop-fade-enter-from,
.drop-fade-leave-to {
  opacity: 0;
}
</style>
