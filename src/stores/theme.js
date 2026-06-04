/**
 * src/stores/theme.js - 主题状态管理 (Pinia Store)
 * 
 * 管理应用主题切换：黑夜、白天、护眼三套主题。
 * 通过设置 <html> 上的 data-theme 属性切换 CSS 变量。
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/** 可用主题列表 */
export const THEMES = [
  { id: 'dark', label: '黑夜', monacoTheme: 'vs-dark' },
  { id: 'light', label: '白天', monacoTheme: 'vs' },
  { id: 'eye-care', label: '护眼', monacoTheme: 'eye-care' },
]

const THEME_STORAGE_KEY = 'txtedit-theme'

export const useThemeStore = defineStore('theme', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** 当前主题 ID，从 localStorage 读取，默认为 eye-care */
  const current = ref(loadTheme())

  // ============================================================
  // 操作方法
  // ============================================================

  /** 切换主题 */
  function setTheme(themeId) {
    current.value = themeId
    applyTheme(themeId)
    saveTheme(themeId)
  }

  /** 应用到 DOM */
  function applyTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId)
  }

  // 初始化时应用主题
  applyTheme(current.value)

  return {
    current,
    setTheme,
  }
})

/**
 * 从 localStorage 读取主题偏好
 * @returns {string} 主题 ID
 */
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && THEMES.some(t => t.id === saved)) {
      return saved
    }
  } catch (e) {
    // ignore
  }
  return 'eye-care'
}

/**
 * 持久化主题偏好到 localStorage
 * @param {string} themeId
 */
function saveTheme(themeId) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId)
  } catch (e) {
    // ignore
  }
}
