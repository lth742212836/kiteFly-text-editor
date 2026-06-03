/**
 * src/stores/sidebar.js - 侧边栏状态管理 (Pinia Store)
 * 
 * 管理侧边栏的显示/隐藏状态、文件夹浏览和最近文件列表。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** 侧边栏是否可见 */
  const visible = ref(true)

  /** 当前浏览的文件夹路径 */
  const currentFolder = ref(null)

  /** 文件夹下的文件列表 */
  const folderEntries = ref([])

  /** 最近打开的文件列表 */
  const recentFiles = ref([])

  // ============================================================
  // 计算属性
  // ============================================================

  /** 侧边栏宽度 */
  const sidebarWidth = computed(() => visible.value ? 260 : 0)

  // ============================================================
  // 操作方法
  // ============================================================

  /** 切换侧边栏显示/隐藏 */
  function toggle() {
    visible.value = !visible.value
  }

  /** 设置侧边栏可见性 */
  function setVisible(value) {
    visible.value = value
  }

  /** 设置当前浏览的文件夹 */
  function setCurrentFolder(folderPath) {
    currentFolder.value = folderPath
  }

  /** 更新文件夹内容列表 */
  function setFolderEntries(entries) {
    folderEntries.value = entries
  }

  /** 更新最近文件列表 */
  function setRecentFiles(files) {
    recentFiles.value = files
  }

  /** 加载最近文件列表 */
  async function loadRecentFiles() {
    try {
      const files = await window.electronAPI.getRecentFiles()
      recentFiles.value = files
    } catch (e) {
      console.error('加载最近文件失败:', e)
    }
  }

  return {
    visible,
    currentFolder,
    folderEntries,
    recentFiles,
    sidebarWidth,
    toggle,
    setVisible,
    setCurrentFolder,
    setFolderEntries,
    setRecentFiles,
    loadRecentFiles,
  }
})
