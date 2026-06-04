<!--
  Sidebar.vue - 侧边栏组件
  
  显示文件浏览器和最近打开的文件列表。
  支持：
  - 文件夹内容浏览
  - 点击文件在编辑器中打开
  - 最近打开文件快捷访问
-->
<template>
  <div class="sidebar">
    <!-- 最近打开的文件 -->
    <div class="sidebar-section">
      <div class="section-header">
        <span class="section-title">最近打开</span>
      </div>
      <div class="section-content">
        <div v-if="sidebarStore.recentFiles.length === 0" class="empty-hint">
          暂无最近文件
        </div>
        <div
          v-for="filePath in sidebarStore.recentFiles"
          :key="filePath"
          class="file-item"
          :title="filePath"
          @click="openFile(filePath)"
        >
          <span class="file-icon">📄</span>
          <span class="file-name">{{ getFileName(filePath) }}</span>
          <span class="file-path">{{ getDirName(filePath) }}</span>
          <span class="file-remove" title="从列表中移除" @click="removeRecent($event, filePath)">×</span>
        </div>
      </div>
    </div>

    <!-- 文件夹浏览器 -->
    <div v-if="sidebarStore.currentFolder" class="sidebar-section">
      <div class="section-header">
        <span class="section-title">文件浏览</span>
        <span class="folder-path">{{ sidebarStore.currentFolder }}</span>
      </div>
      <div class="section-content">
        <div v-if="sidebarStore.folderEntries.length === 0" class="empty-hint">
          文件夹为空
        </div>
        <div
          v-for="entry in sidebarStore.folderEntries"
          :key="entry.path"
          class="file-item"
          :title="entry.name"
          @click="handleEntryClick(entry)"
        >
          <span class="file-icon">{{ entry.isDirectory ? '📁' : '📄' }}</span>
          <span class="file-name">{{ entry.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Sidebar.vue - 侧边栏组件逻辑
 */
import { inject, ref } from 'vue'
import { useSidebarStore } from '@/stores/sidebar'

const sidebarStore = useSidebarStore()
const editorPanelRef = inject('editorPanelRef')

/** 正在删除的文件路径，用于阻止 openFile 在删除期间被意外触发 */
const deletingFile = ref(null)

/**
 * 从文件路径提取文件名
 * @param {string} filePath - 文件绝对路径
 * @returns {string} 文件名
 */
function getFileName(filePath) {
  return filePath.split(/[/\\]/).pop()
}

/**
 * 从文件路径提取目录名
 * @param {string} filePath - 文件绝对路径
 * @returns {string} 目录路径
 */
function getDirName(filePath) {
  const parts = filePath.split(/[/\\]/)
  parts.pop()
  return parts.join('/')
}

/**
 * 在编辑器中打开文件
 * @param {string} filePath - 文件路径
 */
async function openFile(filePath) {
  // 如果正在删除该文件，跳过打开操作
  if (deletingFile.value === filePath) return
  editorPanelRef.value?.openFiles([filePath])
}

/**
 * 从最近文件列表中移除文件
 * @param {MouseEvent} event - 鼠标事件
 * @param {string} filePath - 文件路径
 */
async function removeRecent(event, filePath) {
  event.stopPropagation()
  event.preventDefault()
  // 设置删除标记，防止 openFile 被意外触发
  deletingFile.value = filePath
  if (confirm(`确定要从列表中移除 "${getFileName(filePath)}" 吗？`)) {
    await sidebarStore.removeRecentFile(filePath)
  }
  deletingFile.value = null
}

/**
 * 处理侧边栏文件/文件夹点击
 * @param {Object} entry - 文件/文件夹条目
 */
async function handleEntryClick(entry) {
  if (entry.isDirectory) {
    // 进入子目录
    sidebarStore.setCurrentFolder(entry.path)
    try {
      const result = await window.electronAPI.listDir(entry.path)
      if (result.success) {
        sidebarStore.setFolderEntries(result.entries)
      }
    } catch (e) {
      console.error('加载文件夹失败:', e)
    }
  } else if (entry.isTextFile) {
    // 打开文本文件
    openFile(entry.path)
  }
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 4px;
  flex-shrink: 0;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.folder-path {
  font-size: 10px;
  color: var(--text-muted);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.6;
}

.section-content {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
}

.empty-hint {
  padding: 20px 12px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 12px;
  position: relative;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-item:hover .file-remove {
  opacity: 1;
}

.file-icon {
  font-size: 13px;
  flex-shrink: 0;
  opacity: 0.8;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.file-path {
  font-size: 10px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
  opacity: 0.5;
}

.file-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  line-height: 1;
}

.file-remove:hover {
  background: rgba(255, 80, 80, 0.15);
  color: #ff5050;
}
</style>
