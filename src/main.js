/**
 * src/main.js - Vue3 应用入口
 * 
 * 初始化 Vue 应用实例，注册路由和状态管理，
 * 挂载应用到 DOM。
 * 
 * 注意：Monaco Editor 的 worker 配置需要在编辑器实例化前完成，
 * 因此在此文件的顶部导入 monaco-setup.js。
 */

// 必须首先导入 Monaco Editor 配置，确保 worker 在编辑器创建前注册
import './monaco-setup.js'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/global.css'

// 创建 Vue 应用实例
const app = createApp(App)

// 注册 Pinia 状态管理
const pinia = createPinia()
app.use(pinia)

// 注册 Vue Router 路由
app.use(router)

// 挂载到 #app 元素
app.mount('#app')
