# 项目重构日志

## 基于 rules.md 重构为 Plasmo 框架

### 框架迁移
- 从 webpack 构建 → **Plasmo** 浏览器扩展框架
- 从 JavaScript → **TypeScript**
- 从原始 CSS → **Tailwind CSS**
- Manifest V3（Plasmo 自动生成）

### 项目结构
```
.
├── assets/              # 图标（Plasmo 自动处理大小缩放）
│   ├── icon.png         # 扩展图标
│   └── logo.png         # 侧边栏 Logo
├── src/
│   ├── sidepanel.tsx    # 侧边栏主界面
│   ├── background.ts    # Service Worker
│   ├── content.ts       # Content Script 入口
│   ├── style.css        # Tailwind 基础样式
│   ├── common/
│   │   ├── feature-manager.ts  # 功能注册管理
│   │   ├── extract.ts          # Readability 文章提取
│   │   └── ai.ts               # 通用 AI 对接服务（DeepSeek）
│   └── features/
│       ├── links.ts        # 链接可点击
│       ├── books.ts        # 《》书籍识别
│       ├── tables.ts       # 表格 ↔ 图表
│       ├── copy.ts         # 移除复制屏蔽
│       ├── annotations.ts  # 注释气泡
│       ├── download.ts     # 一键下载 MD
│       └── export.ts       # PDF / 图片导出
├── postcss.config.js    # PostCSS + Tailwind
├── tailwind.config.js   # Tailwind JIT 模式
├── tsconfig.json        # TypeScript 配置
└── package.json         # Plasmo + 依赖
```

### 侧边栏 UI
- 2 个菜单 Tab：**功能** / **系统设置**
- 功能列表：开关 toggle 控制各 feature 启用/禁用
- 系统设置：DeepSeek API Key 配置

### AI 服务（2025.06.17）
- `common/ai.ts`：仅支持 DeepSeek 专用 API
- endpoint 和 model 硬编码，用户只需配 API Key
- 用于后续书籍 AI 识别提取

### 变更记录（2025.06.17）
- 移除「产品说明」Tab
- 移除页面注入的浮窗导出按钮（toolbar.ts）
- 系统设置页改为 DeepSeek API Key 配置表单
- UI 色系统一为 logo 温暖橙色系

### 构建
- `npm run build` / `npm run dev`
- 输出到 `build/chrome-mv3-prod/`
