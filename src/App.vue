<!--
  App.vue - 应用根组件
  
  包含全局快捷键注册和路由视图。
  所有子组件在此渲染。
-->
<template>
  <router-view />
</template>

<script setup>
/**
 * App.vue - 应用根组件
 * 
 * 职责：
 * 1. 提供路由视图容器
 * 2. 后续可在此注册全局事件监听
 */
import { onMounted } from 'vue'

onMounted(() => {
  console.log('[TxtEdit] 应用已启动')
})
</script>

<style scoped>
/* 根组件无需额外样式，由 global.css 统一管理 */
</style>
