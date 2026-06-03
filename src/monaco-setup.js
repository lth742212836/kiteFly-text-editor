/**
 * src/monaco-setup.js - Monaco Editor 环境配置
 * 
 * 配置 Monaco Editor 的 Web Worker 加载路径。
 * 在 Vite + Electron 环境中，需要指定 worker 的加载方式。
 * 
 * 使用方式：在 main.js 中 import 此文件，在创建编辑器之前完成配置。
 */

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

/**
 * 配置 Monaco Editor 的 Worker 环境
 * 使用 Vite 的 ?worker 后缀来正确加载 web worker
 */
self.MonacoEnvironment = {
  /**
   * 根据 worker 类型返回对应的 Worker 实例
   * @param {string} _ - worker 标签（未使用）
   * @param {string} label - worker 类型标识
   * @returns {Worker} Web Worker 实例
   */
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    // 默认使用编辑器核心 worker
    return new editorWorker()
  },
}
