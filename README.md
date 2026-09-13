# NekoHome 工作室 · 官方网站模板

纯前端单页应用（SPA），零构建、零依赖安装，开箱即用。

## 功能特性

- **首页**：左对齐极简大字工作室名 + 明确的「看看作品」入口；滚动时大字缩小、上移并渐隐（CTA 按钮在动画区域之外，保持稳定可点）；底部滚动提示；固定背景 + 微遮罩，滚动时被后续页面自然遮住
- **关于**：左侧简介文字（无卡片盒），右侧 4:3 配图；标签为轻量纯文字（间隔号分隔，非胶囊）
- **作品**：读取 `data/repos.json` 中的 GitHub 仓库链接，前端自动调用 GitHub API 解析出仓库名、简介、Star / Fork 数，朴素的描边卡片 3 列排布，带骨架屏加载
- **加入**：朴素的文字条目 + QQ 群区（无卡片托盘，群号一键复制，含降级方案；一键加群跳转链接）
- **页脚**：Logo + 工作室名、4 个页面跳转、ICP 备案号
- **全局**：顶栏滑动指示器随当前页顺畅移动、各页面收敛的进场动画
- **滚动**：Lenis 惯性平滑滚动，内容驱动、无整屏吸附；降级时回退原生平滑滚动
- **主题**：暖白（墨色文字）/ 炭灰双主题，克制的蓝色点缀，深浅色切换（顶栏按钮），默认跟随系统，选择记忆在 localStorage
- **背景**：固定背景图（`assets/background.webp`，由 ffmpeg 自 jpg 转换）+ 微遮罩；首页另有一层极淡的静态细线网格（径向渐隐、不拦截点击）；无光晕、无玻璃拟态、无渐变文字

## 本地运行

由于页面通过 `fetch` 读取本地 JSON 配置，需要用本地服务器打开（不能直接双击 file://）：

```bash
# 任选一种
python -m http.server 8000
npx serve .
```

然后访问 http://127.0.0.1:8000/

## 自定义配置

主要文案、图片路径与站点参数都在独立的静态文件里，**改数据不用动代码**：

| 文件 | 内容 |
| --- | --- |
| `data/config.json` | 主要文案与参数：工作室信息、首页标题字号、版权模板、QQ/ICP、滚动手感 |
| `data/repos.json` | GitHub 仓库链接数组（填 URL 即可，自动解析） |
| `assets/logo.webp` | Logo 图（顶栏 / 页脚共用，路径可在 config.json 分开改） |
| `assets/about.webp` | 关于页 4:3 形象图（可替换为照片/插画） |
| `assets/background.webp` | 首页固定背景图（可替换） |

### config.json 字段说明

| 字段 | 说明 |
| --- | --- |
| `studioName` / `slogan` / `heroTags` | 工作室名、标语、首页眉标 |
| `hero.titleMinPx` / `titleVw` / `titleMaxPx` | 首页主标题字号 clamp() 三段：最小值、随视口缩放比例、最大值 |
| `copyright` | 版权文本模板，`{year}` 和 `{name}` 会自动替换为当前年份与工作室名 |
| `qqGroup` / `qqJoinUrl` / `icp` | QQ 群号、加群链接、ICP 备案号 |
| `background` | 首页固定背景图路径 |
| `mask.hero` / `mask.panel` | 首页遮罩强度（0~1，默认 0.35）/ 其它页面背景强度（0~1，默认 0.7，即 70% 半透明） |
| `topLogo` / `footerLogo` | 顶栏 / 页脚图标路径（分开可配） |
| `aboutImage` | 关于页 4:3 形象图路径 |
| `scroll.lerp` | 惯性系数（0~1，越小越"糯"，默认 0.1） |
| `scroll.wheelMultiplier` | 滚轮速度倍率 |
| `scroll.anchorDuration` | 导航锚点跳转动画时长（秒） |
| `join.cards[]` | 加入页理由条目，每项仅 `title` + `text` 两个字段（旧的 `icon` 字段已随图标移除，不再使用） |

> 注：`config.json` 中只保留当前生效的字段。首页大字的缩小 / 上移 / 渐隐参数写死在 `js/app.js`（`initParallax`），首页淡网格的间距与透明度写死在 `css/style.css`（`.hero::after`），目前不可通过配置调整；`hero.*` 仅控制主标题字号。

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
