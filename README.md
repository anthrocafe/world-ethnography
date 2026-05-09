# World Ethnography

一个静态网站项目（`index.html` + `styles.css` + `globe.js` + `books-data.js`），适合部署到 Cloudflare Pages / Netlify / Vercel。

## 本地维护流程（可持续）

1. 修改 `民族志信息表.xlsx`
2. 运行同步脚本：
   - `python3 scripts/sync_books_from_xlsx.py`
3. 本地预览：
   - 直接打开 `index.html`，抽查若干卡片内容和样式
4. 提交并推送：
   - `git add .`
   - `git commit -m "update ethnography entries"`
   - `git push`
5. 托管平台自动重新部署上线

## 首次上线（推荐：Cloudflare Pages）

1. 把项目推到 GitHub 仓库
2. 进入 Cloudflare Dashboard -> Pages -> Create project
3. 连接 GitHub 仓库并选择本项目
4. Build settings:
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`（根目录）
5. Deploy，等待完成后获得 `*.pages.dev` 访问地址

## 自定义域名（可选）

1. 在 Pages 项目里添加你的域名
2. 按 Cloudflare 提示配置 DNS
3. SSL 会自动签发，生效后可通过你的域名访问

## 说明

- `books-data.js` 是网站最终数据源
- `民族志信息表.xlsx` 是便于人工维护的源表
- 同步脚本会：
  - 将表中不存在的条目从网站数据中删除
  - 按英文标题同步中文译名
  - 校验同步后条目集合是否与表格一致

