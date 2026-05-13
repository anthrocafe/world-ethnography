# World Ethnography

**全球民族志地图**：在可交互的地球仪上浏览各地的民族志著作，支持关键词搜索与地点聚焦，以卡片形式呈现书目信息与简介。

## 正式网址

**[https://worldethnography.com](https://worldethnography.com)**

在浏览器中打开即可使用；无需安装客户端。

## 项目说明

本站为静态前端项目（`index.html`、`styles.css`、`globe.js`、`books-data.js`），数据由 `books-data.js` 驱动。地图上的点位与书目卡片对应人类学/民族志类作品及其主要田野或叙事发生地，便于从空间维度探索相关阅读。

图书封面仅用于作品识别、介绍与学术传播；版权归原作者或权利人所有。

## 技术栈与部署

- 纯静态资源，可部署在 Cloudflare Pages、Netlify、Vercel 等任意静态托管。
- 构建步骤：将仓库根目录作为站点根目录发布即可（无构建命令亦可）。

## 维护者：本地更新数据（可选）

民族志条目维护用表格**不放入本仓库**（见 `.gitignore` 中的 `民族志信息表*.xlsx`）。请在本地准备与脚本默认路径一致的 xlsx，然后：

1. 编辑本地的 `民族志信息表-0513.xlsx`（或你使用的同系列命名文件）。
2. 运行同步脚本，例如：
   - `python3 scripts/sync_books_from_xlsx.py`  
   - 或仓库内其他 `scripts/*.py`（按你当前工作流选择）。
3. 检查生成的 `books-data.js` 与页面展示。
4. 提交并推送本站相关变更（勿提交 xlsx）。

首次在 Cloudflare Pages 等平台连接本 GitHub 仓库时：Framework 选 None，输出目录为 `/`，构建命令留空即可。
