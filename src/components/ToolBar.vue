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
    <div class="toolbar-left">
      <!-- ======== 文件操作组 ======== -->
      <div class="toolbar-group" data-group="文件">
        <button
          class="toolbar-btn"
          aria-label="新建文件"
          :data-shortcut="k('Ctrl+N')"
          @click="onNewFile"
          @mouseenter="onBtnHover($event, '新建文件', k('Ctrl+N'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </button>
        <button
          class="toolbar-btn"
          aria-label="打开文件"
          :data-shortcut="k('Ctrl+O')"
          @click="onOpenFile"
          @mouseenter="onBtnHover($event, '打开文件', k('Ctrl+O'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <!-- ======== 保存操作组 ======== -->
      <div class="toolbar-group" data-group="保存">
        <button
          class="toolbar-btn"
          aria-label="保存"
          :data-shortcut="k('Ctrl+S')"
          @click="onSave"
          @mouseenter="onBtnHover($event, '保存', k('Ctrl+S'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>
        <button
          class="toolbar-btn"
          aria-label="另存为"
          :data-shortcut="k('Ctrl+Shift+S')"
          @click="onSaveAs"
          @mouseenter="onBtnHover($event, '另存为', k('Ctrl+Shift+S'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <!-- ======== 编辑操作组 ======== -->
      <div class="toolbar-group" data-group="编辑">
        <button
          class="toolbar-btn"
          aria-label="撤销"
          :data-shortcut="k('Ctrl+Z')"
          @click="onUndo"
          @mouseenter="onBtnHover($event, '撤销', k('Ctrl+Z'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button
          class="toolbar-btn"
          aria-label="重做"
          :data-shortcut="k('Ctrl+Shift+Z')"
          @click="onRedo"
          @mouseenter="onBtnHover($event, '重做', k('Ctrl+Shift+Z'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <!-- ======== 搜索操作组 ======== -->
      <div class="toolbar-group" data-group="搜索">
        <button
          class="toolbar-btn"
          :class="{ 'toolbar-btn--active': showFindPanel }"
          aria-label="查找"
          :data-shortcut="k('Ctrl+F')"
          @click="onFind"
          @mouseenter="onBtnHover($event, '查找', k('Ctrl+F'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button
          class="toolbar-btn"
          :class="{ 'toolbar-btn--active': showFindPanel }"
          aria-label="替换"
          :data-shortcut="k('Ctrl+R')"
          @click="onReplace"
          @mouseenter="onBtnHover($event, '替换', k('Ctrl+R'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><polyline points="8 8 8 14 14 8 14 14"/></svg>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <!-- ======== 视图操作组 ======== -->
      <div class="toolbar-group" data-group="视图">
        <button
          class="toolbar-btn"
          :class="{ 'toolbar-btn--active': sidebarStore.visible }"
          aria-label="切换侧边栏"
          :data-shortcut="k('Ctrl+B')"
          @click="onToggleSidebar"
          @mouseenter="onBtnHover($event, sidebarStore.visible ? '隐藏侧边栏' : '显示侧边栏', k('Ctrl+B'))"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        </button>
      </div>

      <div class="toolbar-separator"></div>

      <!-- ======== 主题切换 ======== -->
      <div class="toolbar-group" data-group="主题">
        <button
          class="toolbar-btn theme-btn"
          aria-label="切换主题"
          :title="'当前: ' + currentThemeLabel + ' — 点击切换'"
          @click="onToggleTheme"
          @mouseenter="onBtnHover($event, '切换主题', currentThemeLabel)"
          @mouseleave="onBtnLeave"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="themeStore.current === 'dark'">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </template>
            <template v-else-if="themeStore.current === 'light'">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </template>
            <template v-else>
              <path d="M2 12h2"/><path d="M20 12h2"/><path d="M12 2v2"/><path d="M12 20v2"/><circle cx="12" cy="12" r="4"/>
            </template>
          </svg>
        </button>
      </div>
    </div>

    <!-- 自定义悬浮提示 -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="toolbar-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <span class="tooltip-label">{{ tooltip.label }}</span>
        <span v-if="tooltip.shortcut" class="tooltip-shortcut">{{ tooltip.shortcut }}</span>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
/**
 * ToolBar.vue - 工具栏组件逻辑
 * 
 * 按钮按功能分组：文件、保存、编辑、搜索、视图
 * 悬浮 1 秒后显示自定义 tooltip（含功能名 + 快捷键）
 */
import { inject, ref, reactive, computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSidebarStore } from '@/stores/sidebar'
import { useThemeStore, THEMES } from '@/stores/theme'

const tabsStore = useTabsStore()
const sidebarStore = useSidebarStore()
const themeStore = useThemeStore()

/** 当前主题的中文标签 */
const currentThemeLabel = computed(() => {
  const theme = THEMES.find(t => t.id === themeStore.current)
  return theme ? theme.label : '黑夜'
})

// 注入编辑器面板引用
const editorPanelRef = inject('editorPanelRef')
const showFindPanel = inject('showFindPanel')
const findInitialText = inject('findInitialText')

// 平台检测：macOS 用 ⌘，其他平台用 Ctrl
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const modKey = isMac ? '⌘' : 'Ctrl'

/** 将快捷键中的 Ctrl 替换为平台对应的修饰键 */
function k(shortcut) {
  return shortcut.replace(/Ctrl/g, modKey)
}

// ============================================================
// 自定义 Tooltip（悬浮 1 秒后显示）
// ============================================================
const tooltip = reactive({
  visible: false,
  label: '',
  shortcut: '',
  x: 0,
  y: 0,
})

let tooltipTimer = null

/**
 * 鼠标进入按钮：1 秒后显示 tooltip
 * @param {MouseEvent} e
 * @param {string} label - 功能名称
 * @param {string} shortcut - 快捷键
 */
function onBtnHover(e, label, shortcut) {
  clearTimeout(tooltipTimer)
  const rect = e.currentTarget.getBoundingClientRect()
  tooltipTimer = setTimeout(() => {
    tooltip.label = label
    tooltip.shortcut = shortcut
    tooltip.x = rect.left + rect.width / 2
    tooltip.y = rect.bottom + 6
    tooltip.visible = true
  }, 400)
}

/** 鼠标离开按钮：隐藏 tooltip */
function onBtnLeave() {
  clearTimeout(tooltipTimer)
  tooltip.visible = false
}

// ============================================================
// 操作方法
// ============================================================

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

/** 切换查找面板 */
function onFind() {
  if (!showFindPanel.value) {
    findInitialText.value = editorPanelRef.value?.getSelectedText() || ''
  }
  showFindPanel.value = !showFindPanel.value
}

/** 切换替换面板 */
function onReplace() {
  if (!showFindPanel.value) {
    findInitialText.value = editorPanelRef.value?.getSelectedText() || ''
  }
  showFindPanel.value = !showFindPanel.value
}

/** 切换侧边栏 */
function onToggleSidebar() {
  sidebarStore.toggle()
}

/** 循环切换主题：黑夜 → 白天 → 护眼 → 黑夜 */
function onToggleTheme() {
  const idx = THEMES.findIndex(t => t.id === themeStore.current)
  const next = THEMES[(idx + 1) % THEMES.length]
  themeStore.setTheme(next.id)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  height: var(--toolbar-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 6px;
  padding-left: 72px; /* macOS 窗口红绿灯按钮空间 */
  -webkit-app-region: drag;
  user-select: none;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0;
  -webkit-app-region: no-drag;
}

/* 功能分组 */
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn:active {
  background: var(--bg-active);
  color: var(--text-highlight);
}

/* 激活态：查找/替换面板打开时或侧边栏打开时 */
.toolbar-btn--active {
  background: var(--bg-active);
  color: var(--accent);
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 4px;
  opacity: 0.5;
}

/* ============================================================
   自定义 Tooltip 样式（非 scoped，通过 Teleport 渲染到 body）
   ============================================================ */
</style>

<!-- 全局样式：tooltip 渲染在 body 中，不能 scoped -->
<style>
.toolbar-tooltip {
  position: fixed;
  z-index: 10000;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--tooltip-bg);
  border: 1px solid var(--tooltip-border);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
  animation: tooltip-fade-in 0.12s ease-out;
}

.tooltip-label {
  color: var(--tooltip-label);
}

.tooltip-shortcut {
  color: var(--tooltip-shortcut);
  padding: 0 4px;
  background: var(--tooltip-shortcut-bg);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
