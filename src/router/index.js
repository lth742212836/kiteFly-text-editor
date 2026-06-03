/**
 * src/router/index.js - Vue Router 路由配置
 * 
 * 定义应用的路由映射，当前为单页应用，仅需根路由。
 * 编辑器的主界面通过组件组合实现，不依赖路由切换。
 */

import { createRouter, createMemoryHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'editor',
    // 懒加载编辑器主组件
    component: () => import('../views/EditorView.vue'),
  },
]

const router = createRouter({
  // 使用 memory history 模式，避免 Electron file:// 协议下的路由问题
  history: createMemoryHistory(),
  routes,
})

export default router
