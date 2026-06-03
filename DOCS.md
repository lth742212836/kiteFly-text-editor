# TxtEdit - 跨平台文本编辑器

基于 **Electron + Vue3** 的跨平台文本编辑器，支持 macOS、Windows、Linux 三大平台。

## 功能特性

- **多标签页编辑** - 像浏览器一样在多个标签页中打开和编辑文件
- **语法高亮** - 集成 Monaco Editor（VS Code 核心编辑器），支持 40+ 语言语法高亮
- **查找替换** - 支持大小写敏感、全词匹配、正则表达式查找替换
- **编码支持** - 自动检测文件编码，支持 UTF-8、GBK、Big5、Shift_JIS 等多种编码
- **文件浏览** - 侧边栏文件浏览器，支持文件夹浏览和最近文件快速访问
- **快捷键操作** - 完整的键盘快捷键支持，提升编辑效率
- **暗色主题** - 模仿 VS Code 的暗色主题，护眼舒适

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 30.x | 跨平台桌面应用框架 |
| Vue 3.4 | 前端 UI 框架 |
| Pinia | Vue 状态管理 |
| Vue Router | 路由管理 |
| Monaco Editor | 代码编辑器核心 |
| Vite 5 | 构建工具 |
| electron-builder | 应用打包工具 |
| iconv-lite | 编码转换 |
| jschardet | 编码检测 |

## 项目结构

```
txt-edit/
├── electron/                # Electron 主进程
│   ├── main.js              # 主进程入口，窗口管理、IPC 通信
│   └── preload.js           # 预加载脚本，安全暴露 API
├── src/                     # Vue3 渲染进程
│   ├── main.js              # Vue 应用入口
│   ├── App.vue              # 根组件
│   ├── router/              # 路由配置
│   │   └── index.js
│   ├── stores/              # Pinia 状态管理
│   │   ├── tabs.js          # 标签页状态
│   │   └── sidebar.js       # 侧边栏状态
│   ├── views/               # 页面视图
│   │   └── EditorView.vue   # 编辑器主视图
│   ├── components/          # UI 组件
│   │   ├── ToolBar.vue      # 顶部工具栏
│   │   ├── TabBar.vue       # 标签页栏
│   │   ├── Sidebar.vue      # 侧边栏（文件浏览）
│   │   ├── EditorPanel.vue  # 编辑器面板（Monaco Editor）
│   │   ├── FindReplacePanel.vue  # 查找替换面板
│   │   └── StatusBar.vue    # 底部状态栏
│   └── styles/              # 样式文件
│       └── global.css       # 全局样式
├── scripts/                 # 开发脚本
│   └── dev.js               # 开发模式启动脚本
├── index.html               # HTML 入口
├── vite.config.js           # Vite 构建配置
├── package.json             # 项目配置与依赖
└── DOCS.md                  # 开发文档（本文件）
```

## 快速开始

### 环境要求

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0

### 安装依赖

```bash
cd txt-edit
npm install
```

### 开发模式运行

```bash
npm run electron:dev
```

此命令会同时启动 Vite 开发服务器（HMR 热更新）和 Electron 窗口。

### 构建打包

```bash
# macOS
npm run electron:build:mac

# Windows
npm run electron:build:win

# Linux
npm run electron:build:linux

# 全平台构建
npm run electron:build:all
```

构建产物位于 `release/` 目录。

## 快捷键

> 说明：`Cmd` 对应 macOS 的 ⌘ 键，`Ctrl` 对应 Windows/Linux 的 Ctrl 键。以下统一用 `Ctrl` 表示，macOS 用户请替换为 `Cmd`。

### 文件操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + N` | 新建文件 |
| `Ctrl + O` | 打开文件 |
| `Ctrl + Shift + O` | 打开文件夹 |
| `Ctrl + S` | 保存文件 |
| `Ctrl + Shift + S` | 另存为 |
| `Ctrl + W` | 关闭当前标签页 |

### 编辑操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Shift + Z` | 重做 |
| `Ctrl + X` | 剪切 |
| `Ctrl + C` | 复制 |
| `Ctrl + V` | 粘贴 |
| `Ctrl + A` | 全选 |
| `Ctrl + D` | 选中下一个匹配项 |
| `Ctrl + L` | 选中当前行 |
| `Ctrl + Shift + K` | 删除当前行 |
| `Ctrl + Enter` | 在下方插入新行 |
| `Ctrl + Shift + Enter` | 在上方插入新行 |
| `Ctrl + ]` | 增加缩进 |
| `Ctrl + [` | 减少缩进 |
| `Alt + ↑ / ↓` | 上移/下移当前行 |
| `Ctrl + /` | 切换行注释 |
| `Ctrl + Shift + \` | 跳转到匹配的括号 |
| `Ctrl + Home` | 跳转到文件开头 |
| `Ctrl + End` | 跳转到文件末尾 |

### 查找替换

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + F` | 打开查找面板 |
| `Ctrl + R` | 打开替换面板 |
| `Enter`（查找输入框） | 查找下一个匹配项 |
| `Esc`（查找/替换面板） | 关闭查找/替换面板 |

### 视图操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + B` | 切换侧边栏 |
| `Ctrl + =` / `Ctrl + +` | 放大界面 |
| `Ctrl + -` | 缩小界面 |
| `Ctrl + 0` | 重置缩放 |
| `F11`（Windows/Linux）/ `Ctrl + Cmd + F`（macOS） | 切换全屏 |

### 开发者工具

| 快捷键 | 功能 |
|--------|------|
| `F12` / `Ctrl + Shift + I` | 切换开发者工具 |
| `Ctrl + Shift + F5` | 重新加载窗口 |
| `Ctrl + Shift + Alt + F5` | 强制重新加载 |

### 应用级（macOS）

| 快捷键 | 功能 |
|--------|------|
| `Cmd + Q` | 退出应用 |
| `Cmd + H` | 隐藏应用 |
| `Cmd + Alt + H` | 隐藏其他窗口 |

## 架构设计

### 进程模型

```
┌──────────────────────────────────────┐
│           Main Process (主进程)        │
│  - 窗口管理                           │
│  - 文件系统操作 (fs)                   │
│  - 编码检测 (jschardet)               │
│  - 原生菜单                           │
│  - IPC 通信                           │
└──────────┬───────────────────────────┘
           │ IPC (contextBridge)
┌──────────▼───────────────────────────┐
│        Renderer Process (渲染进程)      │
│  - Vue3 UI                           │
│  - Monaco Editor                     │
│  - Pinia 状态管理                     │
│  - 标签页管理                         │
└──────────────────────────────────────┘
```

### 数据流

1. **文件打开**: 渲染进程 → IPC → 主进程读取文件 → 编码检测 → 返回内容
2. **文件保存**: 渲染进程 → IPC → 主进程编码转换 → 写入磁盘
3. **标签页管理**: Pinia Store 统一管理，组件通过 store 通信
4. **菜单事件**: 主进程菜单 → IPC → 渲染进程监听 → Store/组件响应

### 安全设计

- 启用 `contextIsolation` 上下文隔离
- 通过 `preload.js` 使用 `contextBridge` 安全暴露 API
- 渲染进程不直接访问 Node.js API
- CSP 内容安全策略限制资源加载

## 编码支持

支持以下编码格式的自动检测和手动切换：

| 编码 | 说明 |
|------|------|
| UTF-8 | 国际通用编码（默认） |
| UTF-16 LE/BE | Unicode 双字节编码 |
| GBK / GB2312 | 简体中文编码 |
| Big5 | 繁体中文编码 |
| Shift_JIS | 日文编码 |
| EUC-JP | 日文扩展编码 |
| EUC-KR | 韩文编码 |
| ISO-8859-1 | 西欧语言编码 |
| Windows-1252 | Windows 西欧编码 |
