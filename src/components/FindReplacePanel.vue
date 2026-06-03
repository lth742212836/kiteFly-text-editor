<!--
  FindReplacePanel.vue - 查找替换面板组件
  
  提供文本查找和替换功能，模仿 VS Code 的查找面板设计。
  支持：
  - 大小写敏感
  - 全词匹配
  - 正则表达式
  - 查找上一个/下一个
  - 全部替换
-->
<template>
  <div class="find-panel">
    <!-- 查找输入行 -->
    <div class="find-row">
      <input
        ref="findInputRef"
        v-model="findText"
        class="find-input"
        placeholder="查找"
        @input="onFindInput"
        @keydown.enter="findNext"
        @keydown.escape="emit('close')"
      />
      <span class="find-count" v-if="matchCount > 0">
        {{ currentMatch }}/{{ matchCount }}
      </span>
      <button class="find-btn" title="上一个 (Shift+Enter)" @click="findPrev">↑</button>
      <button class="find-btn" title="下一个 (Enter)" @click="findNext">↓</button>
      <button class="find-btn" title="大小写敏感" :class="{ active: caseSensitive }" @click="caseSensitive = !caseSensitive">Aa</button>
      <button class="find-btn" title="全词匹配" :class="{ active: wholeWord }" @click="wholeWord = !wholeWord">ab</button>
      <button class="find-btn" title="正则表达式" :class="{ active: useRegex }" @click="useRegex = !useRegex">.*</button>
      <button class="find-btn find-close" title="关闭 (Esc)" @click="emit('close')">×</button>
    </div>

    <!-- 替换输入行 -->
    <div class="find-row">
      <input
        v-model="replaceText"
        class="find-input"
        placeholder="替换"
        @keydown.enter="replaceOne"
        @keydown.escape="emit('close')"
      />
      <button class="find-btn replace-btn" title="替换" @click="replaceOne">替换</button>
      <button class="find-btn replace-all-btn" title="全部替换" @click="replaceAll">全部替换</button>
    </div>
  </div>
</template>

<script setup>
/**
 * FindReplacePanel.vue - 查找替换面板逻辑
 * 
 * 通过 inject 获取 Monaco Editor 实例，使用其查找 API 实现查找替换功能。
 */
import { ref, watch, onMounted, nextTick, inject } from 'vue'
import { useTabsStore } from '@/stores/tabs'

const tabsStore = useTabsStore()

const emit = defineEmits(['close'])

// 从 EditorPanel 注入 Monaco 实例和编辑器引用
const monaco = inject('monacoInstance', null)
const editorRef = inject('editorRef', null)

// 查找状态
const findInputRef = ref(null)
const findText = ref('')
const replaceText = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const useRegex = ref(false)

const matchCount = ref(0)
const currentMatch = ref(0)

// 存储当前查找匹配结果
let findMatches = []
let currentMatchIndex = -1
let decorations = []

onMounted(async () => {
  await nextTick()
  findInputRef.value?.focus()
})

// 监听查找选项变化，重新搜索
watch([caseSensitive, wholeWord, useRegex], () => {
  if (findText.value) {
    performFind()
  }
})

/**
 * 获取当前编辑器实例
 */
function getEditor() {
  return editorRef?.value || null
}

/**
 * 查找输入变化处理
 */
function onFindInput() {
  if (findText.value) {
    performFind()
  } else {
    clearFind()
  }
}

/**
 * 执行查找操作
 * 使用 Monaco Editor 的 findMatches API
 */
function performFind() {
  const editor = getEditor()
  if (!editor || !findText.value || !monaco) {
    clearFind()
    return
  }

  try {
    const model = editor.getModel()
    if (!model) return

    const searchString = findText.value

    // 验证正则表达式
    if (useRegex.value) {
      try {
        new RegExp(searchString)
      } catch (e) {
        matchCount.value = 0
        return
      }
    }

    // 使用 Monaco 的查找 API
    findMatches = model.findMatches(
      searchString,
      true,   // searchOnlyEditableRange
      useRegex.value,
      caseSensitive.value,
      wholeWord.value ? ' ' + searchString + ' ' : null,
      true    // searchInSelection
    )

    matchCount.value = findMatches.length
    currentMatchIndex = -1

    // 高亮所有匹配项
    highlightMatches()

    // 定位到第一个匹配项
    if (findMatches.length > 0) {
      findNext()
    }
  } catch (e) {
    console.error('查找出错:', e)
  }
}

/**
 * 查找下一个匹配项
 */
function findNext() {
  const editor = getEditor()
  if (!editor || findMatches.length === 0) return

  currentMatchIndex = (currentMatchIndex + 1) % findMatches.length
  currentMatch.value = currentMatchIndex + 1

  const match = findMatches[currentMatchIndex]
  editor.setSelection(match.range)
  editor.revealRangeInCenter(match.range)
  
  // 更新高亮中的当前匹配项
  highlightMatches()
}

/**
 * 查找上一个匹配项
 */
function findPrev() {
  const editor = getEditor()
  if (!editor || findMatches.length === 0) return

  currentMatchIndex = currentMatchIndex <= 0 ? findMatches.length - 1 : currentMatchIndex - 1
  currentMatch.value = currentMatchIndex + 1

  const match = findMatches[currentMatchIndex]
  editor.setSelection(match.range)
  editor.revealRangeInCenter(match.range)
  
  // 更新高亮中的当前匹配项
  highlightMatches()
}

/**
 * 替换当前匹配项
 */
function replaceOne() {
  const editor = getEditor()
  if (!editor || findMatches.length === 0 || currentMatchIndex < 0) return

  const match = findMatches[currentMatchIndex]
  editor.executeEdits('replace', [
    { range: match.range, text: replaceText.value },
  ])

  // 重新查找
  performFind()
}

/**
 * 替换所有匹配项
 */
function replaceAll() {
  const editor = getEditor()
  if (!editor || !findText.value) return

  const model = editor.getModel()
  if (!model) return

  try {
    // 查找所有匹配项
    const allMatches = model.findMatches(
      findText.value,
      false,
      useRegex.value,
      caseSensitive.value,
      wholeWord.value ? ' ' + findText.value + ' ' : null,
      false
    )

    if (allMatches.length === 0) return

    // 从后往前替换，避免位置偏移
    const edits = allMatches.reverse().map(match => ({
      range: match.range,
      text: replaceText.value,
    }))

    editor.executeEdits('replace-all', edits)
    
    clearFind()
  } catch (e) {
    console.error('替换出错:', e)
  }
}

/**
 * 高亮所有匹配项
 */
function highlightMatches() {
  const editor = getEditor()
  if (!editor) return

  // 清除旧的高亮
  decorations = editor.deltaDecorations(decorations, [])

  if (findMatches.length === 0) return

  // 创建新的装饰器来高亮匹配项
  const newDecorations = findMatches.map((match, index) => ({
    range: match.range,
    options: {
      className: index === currentMatchIndex ? 'find-match-current' : 'find-match',
      inlineClassName: index === currentMatchIndex ? 'find-match-current' : 'find-match',
    },
  }))

  decorations = editor.deltaDecorations([], newDecorations)
}

/**
 * 清除查找状态
 */
function clearFind() {
  const editor = getEditor()
  
  findMatches = []
  currentMatchIndex = -1
  matchCount.value = 0
  currentMatch.value = 0

  if (editor) {
    decorations = editor.deltaDecorations(decorations, [])
  }
}
</script>

<style scoped>
.find-panel {
  background: var(--bg-find);
  border-bottom: 1px solid var(--border-color);
  padding: 4px 8px;
  flex-shrink: 0;
}

.find-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.find-row:last-child {
  margin-bottom: 0;
}

.find-input {
  flex: 1;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  min-width: 200px;
}

.find-input:focus {
  border-color: var(--accent);
}

.find-input::placeholder {
  color: var(--text-muted);
}

.find-count {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
  user-select: none;
}

.find-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.find-btn:hover {
  background: var(--bg-hover);
}

.find-btn.active {
  background: var(--bg-active);
  border-color: var(--accent);
  color: var(--text-highlight);
}

.find-close {
  font-size: 16px;
  margin-left: 4px;
}

.replace-btn,
.replace-all-btn {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
  white-space: nowrap;
}

.replace-all-btn {
  margin-left: 2px;
}
</style>
