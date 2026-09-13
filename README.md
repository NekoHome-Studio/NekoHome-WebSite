# NekoHome 工作室 · 官方网站模板

纯前端单页应用（SPA），零构建、零依赖安装，开箱即用。

## 功能特性

- **首页**：极简大字工作室名，滚动时大字缩小上移渐隐；底部滚动提示；固定背景 + 微遮罩，滚动时被后续页面自然遮住
- **关于**：左侧简介玻璃卡片（带渐变托盘），右侧 4:3 配图，整行垂直居中
- **产品**：读取 `data/repos.json` 中的 GitHub 仓库链接，前端自动调用 GitHub API 解析出仓库名、简介、Star / Fork 数，长方形小卡片 3 列居中排布，带骨架屏加载
- **加入**：QQ 群号一键复制（含降级方案）+ QQ 加群跳转链接
- **页脚**：Logo + 大字工作室名、4 个页面跳转、ICP 备案号
- **全局**：顶栏滑动指示器随当前页顺畅移动、各页面进场动画
- **滚动**：Lenis 惯性平滑滚动，停稳后轻微吸附到整屏页面（加入我们/页脚不吸附）；降级时回退原生平滑 + CSS 吸附
- **主题**：浅蓝配色，深浅色切换（顶栏按钮），默认跟随系统，选择记忆在 localStorage
- **背景**：固定背景图（`assets/background.webp`，由 ffmpeg 自 jpg 转换）+ 微遮罩 + 光晕网格

## 本地运行

由于页面通过 `fetch` 读取本地 JSON 配置，需要用本地服务器打开（不能直接双击 file://）：

```bash
# 任选一种
python -m http.server 8000
npx serve .
```

然后访问 http://127.0.0.1:8000/

## 自定义配置

所有文案与链接都在独立的静态文件里，**改数据不用动代码**：

| 文件 | 内容 |
| --- | --- |
| `data/config.json` | 全部文案与参数：工作室信息、首页标题字号、版权模板、QQ/ICP、滚动手感 |
| `data/repos.json` | GitHub 仓库链接数组（填 URL 即可，自动解析） |
| `assets/logo.svg` | Logo 占位图（可替换） |

> 首屏加载遮罩不由 config.json 控制，开关在 `index.html` 顶部内联常量 `NK_LOADING_ENABLED`（`true` 开 / `false` 关，关闭时渲染前即隐藏，零闪烁）。
| `assets/about.svg` | 关于页 4:3 占位图（可替换为照片/插画） |
| `assets/background.webp` | 首页固定背景图（可替换） |

### config.json 字段说明

| 字段 | 说明 |
| --- | --- |
| `studioName` / `slogan` / `heroTags` | 工作室名、标语、首页眉标 |
| `hero.titleMinPx` / `titleVw` / `titleMaxPx` | 首页主标题字号 clamp() 三段：最小值、随视口缩放比例、最大值 |
| `copyright` | 版权文本模板，`{year}` 和 `{name}` 会自动替换为当前年份与工作室名 |
| `qqGroup` / `qqJoinUrl` / `icp` | QQ 群号、加群链接、ICP 备案号 |
| `background` | 首页固定背景图路径 |
| `loading` | 是否启用首屏加载遮罩（`true`/`false`，写入 localStorage 后下次加载零闪烁生效） |
| `mask.hero` / `mask.panel` | 首页遮罩强度（0~1）/ 其它页面遮罩强度（0~1，即面板透明度） |
| `topLogo` / `footerLogo` | 顶栏 / 页脚图标路径（分开可配） |
| `aboutImage` | 关于页 4:3 形象图路径 |
| `scroll.lerp` | 惯性系数（0~1，越小越"糯"，默认 0.1） |
| `scroll.wheelMultiplier` | 滚轮速度倍率 |
| `scroll.anchorDuration` | 导航锚点跳转动画时长（秒） |
| `scroll.snapMaxDist` | 吸附触发距离（视口高度的倍数，默认 0.5） |
| `scroll.snapDelay` | 停稳判定延迟（毫秒） |
| `scroll.snapVelocity` / `snapDuration` | 吸附速度阈值 / 吸附动画时长（秒） |

## 技术说明

- Bootstrap 5.3（本地 `vendor/`，仅使用网格与少量工具类）+ 原生 CSS/JS，无构建步骤
- 深浅主题基于 `data-bs-theme` + CSS 变量切换
- GitHub API 未登录限额 60 次/小时/IP，超限后卡片会显示提示
- 尊重 `prefers-reduced-motion`（降低动效偏好）

## 目录结构

```
├── LICENSE             # MIT 许可证
├── index.html          # 页面结构
├── css/style.css       # 全部样式（双主题变量）
├── js/app.js           # 全部逻辑
├── data/
│   ├── config.json     # 站点配置
│   └── repos.json      # 仓库链接列表
├── assets/             # Logo / 形象图占位 / 背景图 webp
└── vendor/
    ├── bootstrap/      # Bootstrap 5.3.3 本地副本
    └── lenis/          # Lenis 惯性平滑滚动本地副本
```
