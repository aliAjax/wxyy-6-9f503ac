# 考古现场拼碎片 (Archaeology Puzzle)

一款纯前端静态网页小游戏：在考古探方中挖掘碎片，在修复台中拼合复原文物。支持多文化层、自定义关卡编辑器、修复目标挑战、操作回放等功能。

## 快速试玩

无需安装任何依赖，直接用浏览器打开 `index.html` 即可开始游戏。

也可以通过本地服务器启动：

```bash
npm install
npm start
```

浏览器会自动打开 `http://localhost:8080`。

## 项目结构

```
├── index.html          # 游戏入口页面
├── style.css           # 全部样式
├── app.js              # UI 交互与游戏流程控制
├── core.js             # 核心逻辑（评分、图层、目标校验，可在 Node 中运行）
├── levels.js           # 官方关卡模板
├── game-data.js        # 通用数据与工具（存储、随机数、事件类型）
├── scripts/
│   └── validate-static.js  # 静态资源校验脚本
├── test/
│   ├── runner.js       # 极简测试运行器
│   └── core.test.js    # 核心逻辑单元测试
├── package.json
├── .eslintrc.json      # ESLint 配置
├── .prettierrc         # Prettier 配置
└── .github/workflows/ci.yml   # CI 自动化配置
```

## 开发指南

### 环境要求

- Node.js >= 16

### 安装依赖

```bash
npm install
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动本地预览服务器并自动打开浏览器 |
| `npm run dev` | 启动本地预览服务器（不自动打开浏览器） |
| `npm test` | 运行核心逻辑单元测试 |
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm run lint:fix` | 自动修复 ESLint 可修复的问题 |
| `npm run format` | 使用 Prettier 格式化所有代码 |
| `npm run format:check` | 检查格式是否符合 Prettier 规范 |
| `npm run validate` | 校验静态资源（HTML 引用、JS 语法、CSS 完整性） |
| `npm run check` | 一键运行全部质量检查：lint + format + validate + test |

### 一条龙质量检查

提交代码前运行：

```bash
npm run check
```

该命令会依次执行 ESLint、Prettier 格式检查、静态资源校验和单元测试，全部通过才算成功。

## 代码约定

- **不引入重型框架**：保持原生 HTML/CSS/JS 结构，浏览器直接打开即可运行
- **core.js 纯函数化**：核心逻辑不依赖 DOM，可在 Node.js 中直接测试
- **浏览器全局变量兼容**：JS 文件在浏览器中通过 `<script>` 加载为全局变量，在 Node.js 中通过 `module.exports` 导出
- **使用 Prettier 统一格式**：提交前运行 `npm run format`

## 静态资源校验说明

`npm run validate` 会检查：

1. `index.html` 是否存在
2. HTML 中所有 `<script src>` 和 `<link rel="stylesheet">` 引用的本地文件是否真实存在
3. 所有引用的 JS 文件语法是否正确（使用 Node.js `vm.Script` 解析）
4. CSS 文件花括号是否匹配、文件是否非空

这确保了 `index.html`、`style.css`、`app.js` 等核心文件不会出现明显的加载断链或语法错误，可直接在 CI 中使用。

## CI 自动化

项目内置 GitHub Actions 工作流（`.github/workflows/ci.yml`），每次 push 或 PR 都会自动：

1. 安装 Node.js 与依赖
2. 运行 `npm run check`（lint + format + validate + test）

## 添加新关卡

关卡数据集中在 `levels.js` 的 `artifactTemplates` 对象中。复制现有模板并修改 `buried`（探方埋藏位置）、`pieceDefs`（碎片定义与目标槽位）、`layers`（文化层配置）等字段即可。

可使用游戏内的「🛠️ 关卡编辑器」可视化创建，然后导出 JSON 粘贴到 `levels.js`。
