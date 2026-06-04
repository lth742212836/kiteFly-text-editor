<!--
  TabBar.vue - 标签页栏组件
  
  显示所有打开的文件标签页，支持：
  - 点击切换标签页
  - 右键菜单（关闭、关闭其他、关闭所有）
  - 拖拽排序（预留）
  - 修改状态指示器（圆点）
-->
<template>
  <div class="tab-bar">
    <!-- 标签页列表 -->
    <div class="tab-list" ref="tabListRef">
      <div
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: tab.id === tabsStore.activeTabId }"
        @click="tabsStore.setActiveTab(tab.id)"
        @mousedown.middle.prevent="tabsStore.closeTab(tab.id)"
        @contextmenu.prevent="showContextMenu($event, tab)"
      >
        <!-- 修改指示器 -->
        <span class="tab-dot" :class="{ modified: tab.modified }"></span>
        
        <!-- 文件名 -->
        <span class="tab-title">{{ tab.title }}</span>
        
        <!-- 关闭按钮 -->
        <button
          class="tab-close"
          @click.stop="tabsStore.closeTab(tab.id)"
          title="关闭标签页"
        >×</button>
      </div>
    </div>

    <!-- 右键上下文菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="closeTab">关闭</div>
      <div class="context-menu-item" @click="closeLeftTabs">关闭左侧</div>
      <div class="context-menu-item" @click="closeRightTabs">关闭右侧</div>
      <div class="context-menu-item" @click="closeOtherTabs">关闭其他</div>
      <div class="context-menu-item" @click="closeAllTabs">关闭所有</div>
    </div>
  </div>
</template>

<script setup>
/**
 * TabBar.vue - 标签页栏组件逻辑
 */
import { ref, reactive } from 'vue'
import { useTabsStore } from '@/stores/tabs'

const tabsStore = useTabsStore()

const tabListRef = ref(null)

// 右键菜单状态
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  tabId: null,
})

/**
 * 显示右键上下文菜单
 * @param {MouseEvent} event - 鼠标事件
 * @param {Object} tab - 标签页对象
 */
function showContextMenu(event, tab) {
  contextMenu.visible = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.tabId = tab.id

  // 点击其他地方关闭菜单（延迟注册，避免当前右键事件触发关闭）
  const closeMenu = (e) => {
    // 忽略菜单项上的点击（菜单项自己处理关闭）
    if (e.target.closest('.context-menu')) return
    contextMenu.visible = false
    document.removeEventListener('click', closeMenu)
  }
  setTimeout(() => document.addEventListener('click', closeMenu), 0)
}

/** 关闭当前右键选中的标签页 */
function closeTab() {
  if (contextMenu.tabId) {
    tabsStore.closeTab(contextMenu.tabId)
  }
  contextMenu.visible = false
}

/** 关闭左侧所有标签页 */
function closeLeftTabs() {
  if (contextMenu.tabId) {
    tabsStore.closeLeftTabs(contextMenu.tabId)
  }
  contextMenu.visible = false
}

/** 关闭右侧所有标签页 */
function closeRightTabs() {
  if (contextMenu.tabId) {
    tabsStore.closeRightTabs(contextMenu.tabId)
  }
  contextMenu.visible = false
}

/** 关闭除当前外的其他标签页 */
function closeOtherTabs() {
  if (contextMenu.tabId) {
    tabsStore.closeOtherTabs(contextMenu.tabId)
  }
  contextMenu.visible = false
}

/** 关闭所有标签页 */
function closeAllTabs() {
  tabsStore.closeAllTabs()
  contextMenu.visible = false
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: var(--tab-height);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
}

.tab-list {
  display: flex;
  align-items: stretch;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
}

.tab-list::-webkit-scrollbar {
  height: 2px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  min-width: 100px;
  max-width: 180px;
  height: 100%;
  background: var(--bg-tab-inactive);
  border-right: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s;
  position: relative;
}

.tab-item:hover {
  background: var(--bg-hover);
}

.tab-item.active {
  background: var(--bg-tab-active);
  color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
}

.tab-dot.modified {
  background: var(--warning);
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}

.tab-item:hover .tab-close,
.tab-item.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-primary);
}

/* 右键上下文菜单 */
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 140px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  padding: 4px 0;
}

.context-menu-item {
  padding: 5px 14px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--accent);
  color: #fff;
}
</style>
