<!--
  ToolBar.vue - 顶部工具栏组件
  
  提供常用操作的快捷按钮：
  - 新建文件
  - 打开文件/文件夹
  - 保存/另存为
  - 撤销/重做
  - 查找/替换
-->
<template>
  <div class="toolbar">
    <!-- 左侧操作按钮组 -->
    <div class="toolbar-left">
      <!-- 新建文件 -->
      <button class="toolbar-btn" title="新建文件 (Ctrl+N)" @click="onNewFile">
        <span class="icon">📄</span>
        <span class="label">新建</span>
      </button>

      <!-- 打开文件 -->
      <button class="toolbar-btn" title="打开文件 (Ctrl+O)" @click="onOpenFile">
        <span class="icon">📂</span>
        <span class="label">打开</span>
      </button>

      <!-- 打开文件夹 -->
      <button class="toolbar-btn" title="打开文件夹 (Ctrl+Shift+O)" @click="onOpenFolder">
        <span class="icon">📁</span>
        <span class="label">文件夹</span>
      </button>

      <div class="toolbar-separator"></div>

      <!-- 保存 -->
      <button class="toolbar-btn" title="保存 (Ctrl+S)" @click="onSave">
        <span class="icon">💾</span>
        <span class="label">保存</span>
      </button>

      <!-- 另存为 -->
      <button class="toolbar-btn" title="另存为 (Ctrl+Shift+S)" @click="onSaveAs">
        <span class="icon">📝</span>
        <span class="label">另存为</span>
      </button>

      <div class="toolbar-separator"></div>

      <!-- 撤销 -->
      <button class="toolbar-btn" title="撤销 (Ctrl+Z)" @click="onUndo">
        <span class="icon">↩</span>
        <span class="label">撤销</span>
      </button>

      <!-- 重做 -->
      <button class="toolbar-btn" title="重做 (Ctrl+Shift+Z)" @click="onRedo">
        <span class="icon">↪</span>
        <span class="label">重做</span>
      </button>

      <div class="toolbar-separator"></div>

      <!-- 查找 -->
      <button class="toolbar-btn" title="查找 (Ctrl+F)" @click="onFind">
        <span class="icon">🔍</span>
        <span class="label">查找</span>
      </button>

      <!-- 替换 -->
      <button class="toolbar-btn" title="替换 (Ctrl+R)" @click="onReplace">
        <span class="icon">🔄</span>
        <span class="label">替换</span>
      </button>

      <div class="toolbar-separator"></div>

      <!-- 切换侧边栏 -->
      <button class="toolbar-btn" title="切换侧边栏 (Ctrl+B)" @click="onToggleSidebar">
        <span class="icon">☰</span>
        <span class="label">侧栏</span>
      </button>
    </div>

    <!-- 右侧应用标题 -->
    <div class="toolbar-right">
      <span class="app-title">TxtEdit</span>
    </div>
  </div>
</template>

<script setup>
/**
 * ToolBar.vue - 工具栏组件逻辑
 * 
 * 所有操作通过 emit 事件或直接调用 store 方法完成。
 */
import { inject } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSidebarStore } from '@/stores/sidebar'

const tabsStore = useTabsStore()
const sidebarStore = useSidebarStore()

// 注入编辑器面板引用
const editorPanelRef = inject('editorPanelRef')
const showFindPanel = inject('showFindPanel')

/** 新建文件 */
function onNewFile() {
  tabsStore.createTab()
}

/** 打开文件对话框 */
async function onOpenFile() {
  const filePaths = await window.electronAPI.openFileDialog()
  if (filePaths && filePaths.length > 0) {
    editorPanelRef.value?.openFiles(filePaths)
  }
}

/** 打开文件夹对话框 */
async function onOpenFolder() {
  const folderPath = await window.electronAPI.openFolderDialog()
  if (folderPath) {
    sidebarStore.setCurrentFolder(folderPath)
    try {
      const result = await window.electronAPI.listDir(folderPath)
      if (result.success) {
        sidebarStore.setFolderEntries(result.entries)
      }
    } catch (e) {
      console.error('加载文件夹内容失败:', e)
    }
  }
}

/** 保存当前文件 */
function onSave() {
  editorPanelRef.value?.saveCurrentFile()
}

/** 另存为当前文件 */
function onSaveAs() {
  editorPanelRef.value?.saveCurrentFileAs()
}

/** 撤销 */
function onUndo() {
  editorPanelRef.value?.undo()
}

/** 重做 */
function onRedo() {
  editorPanelRef.value?.redo()
}

/** 显示查找面板 */
function onFind() {
  showFindPanel.value = true
}

/** 显示替换面板 */
function onReplace() {
  showFindPanel.value = true
}

/** 切换侧边栏 */
function onToggleSidebar() {
  sidebarStore.toggle()
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--toolbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 8px;
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.toolbar-right {
  -webkit-app-region: no-drag;
}

.app-title {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 1px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn:active {
  background: var(--bg-active);
}

.toolbar-btn .icon {
  font-size: 14px;
  line-height: 1;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}
</style>
