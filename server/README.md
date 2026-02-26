# 后端爬虫服务

本目录提供一个简单的 Node/Express 服务，用于爬取指定站点并将结果组织成前端 `masami` 应用所需的接口格式。
通过设置环境变量 `SOURCE_BASE` 指定数据源站点地址。

## 快速启动

1. 在项目根目录安装依赖：
   ```bash
   cd masami
   npm install express axios cheerio cors
   # 若需要用并发脚本，还可以安装 concurrently：npm install -D concurrently
   ```
2. 开发运行：
   ```bash
   node server/app.js
   # 或者在 package.json 中添加脚本
   ```
3. 监听 `3000` 端口，前端将访问 `http://localhost:3000/api/...`。

## 路由说明

- `GET /api/search/:name?page=1`
- `GET /api/getAnime/:id`
- `GET /api/getVideo/:key`
- `GET /api/getIndex`
- `GET /api/getConfig`（返回空）

实现方式是使用 [axios](https://www.npmjs.com/package/axios) 拉取对应页面，然后用 [cheerio](https://www.npmjs.com/package/cheerio) 解析 HTML，组装成与前端 `src/api/api.type.ts` 定义一致的 JSON 对象。

## 定制与部署

- 根据网站实际 DOM 调整 `app.js` 中的选择器。
- 若需要真实的分页、周更新、筛选条件，需要分析对应页面并修改爬取逻辑。
- 为了上线可在服务器上使用 PM2 / systemd 启动该 Node 程序，并把前端打包的 `dist` 目录用 Nginx 或其它静态服务器托管。

----

上述代码仅为示例，它的重点是展示“怎样在一个仓库中把前端和爬虫后端放在一起，并且生成前端期望的接口”。
