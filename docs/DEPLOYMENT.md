# CF-drive 全新部署与安全验收

本手册仅适用于全新实例。Worker 名称为 `cf-drive`；首次 Cloudflare Workers Builds 部署会自动创建并绑定新的 R2 桶和 D1 数据库。资源名称由 Cloudflare 生成，并以 `cf-drive` 为前缀。不要把旧项目的 R2、D1 或密钥接入本项目。

## 1. 部署前检查

- 已准备 Cloudflare 账号并启用 Workers、R2、D1。
- 已创建或准备创建 GitHub 仓库，生产分支为 `main`。
- 本地 Node.js 版本为 20 或更高。
- 仓库根目录执行：

```powershell
npm.cmd run verify
```

## 2. 自动创建资源

仓库已提交 `wrangler.toml`，其中只声明 `R2_BUCKET` 与 `DB` 绑定，不含 R2 桶名、D1 数据库名或 D1 ID。首次运行 Cloudflare Workers Builds 的 `npx wrangler deploy` 时，Cloudflare 自动创建并绑定资源。

不要手动创建同名 R2/D1，也不要在 `wrangler.toml` 填入既有资源名称或 ID；这样会将新实例绑定到手工资源，偏离自动创建流程。首次部署完成后，可在 Cloudflare Dashboard 的 R2 与 D1 页面查看 Cloudflare 生成的资源及其绑定。

## 3. 保持部署配置

`wrangler.toml` 不包含密钥，应随代码提交；`.dev.vars`、`.env` 和任何真实凭据不能提交。

## 4. 配置运行时 Secret

首次部署创建 Worker 后，在 **Workers & Pages > cf-drive > Settings > Variables and Secrets** 添加：

| 名称 | 类型 | 要求 |
| --- | --- | --- |
| `ACCESS_PASSWORD` | Secret | 管理端高强度密码。 |
| `SHARE_SECRET` | Secret | 独立、随机、长字符串。 |
| `WEBDAV_USERNAME` | Secret | 仅启用 WebDAV 时设置。 |
| `WEBDAV_PASSWORD` | Secret | 独立于管理端密码。 |
| `STORAGE_NODE_TOKEN` | Secret | 仅将实例作为外部存储节点时设置。 |

首次部署保留 `WEBDAV_ENABLED = "false"`。可选外观变量为 `SITE_TITLE`、`CLOUD_ICON_URL`、`LOGIN_BACKGROUND_URL`；可选下载变量为 `DOWNLOAD_RANGE_SIZE_MB`。

## 5. 连接 GitHub 并自动发布

按 [Cloudflare + GitHub 自动部署教程](./GITHUB_CLOUDFLARE_DEPLOYMENT.md) 设置 Cloudflare Workers Builds。首次发布前须确认：

- Cloudflare 中的 Worker 名称与 `wrangler.toml` 的 `name` 都是 `cf-drive`。
- 首次部署结束后，在 R2 与 D1 页面确认已创建新的、以 `cf-drive` 为前缀的资源。
- `main` 是唯一生产分支。
- Build command 为 `npm run verify`。
- Deploy command 为 `npx wrangler deploy`。
- 非生产分支构建先保持关闭，避免测试写入生产 R2/D1。

## 6. 首次功能验收

1. 登录管理端。
2. 新建目录，上传、下载、重命名、复制、移动和删除一个测试文件。
3. 创建文件分享和目录分享，分别测试密码、到期、访问次数上限、刷新链接、改密和撤销。
4. 在存储节点界面确认未配置节点时主控上传和下载正常；启用节点前单独测试节点 Token。
5. 使用孤儿清扫先执行扫描，确认列表后再清理；不要把清理作为日常删除替代品。

## 7. 启用 WebDAV

仅在完成上节验收后：

1. 设置专用 `WEBDAV_USERNAME`、`WEBDAV_PASSWORD` Secret。
2. 添加普通文本变量 `WEBDAV_ENABLED = "true"`。
3. 可按需设置 `WEBDAV_MAX_UPLOAD_BYTES`，默认 100 MiB。
4. 用目标客户端在隔离目录测试 `PROPFIND`、`GET`、Range GET、`PUT`、`MKCOL`、`COPY`、`MOVE`、`DELETE`、`LOCK`、`UNLOCK`。

入口为 `https://<你的域名>/dav/`。WebDAV 不应直接指向含有生产重要文件的根目录进行首次客户端测试。

## 8. 生产防护与运行维护

- 在 Cloudflare WAF/Rate Limiting 对 `POST /api/login`、`POST /api/share-access`、`/dav/*` 设置按来源 IP 的边缘限速。
- 使用自定义域名时强制 HTTPS；不要暴露不受 Cloudflare 管理的 HTTP 回源。
- Secret 泄露时立即在 Cloudflare 轮换，并使受影响用户重新登录；轮换 `SHARE_SECRET` 会使现有分享密码与授权失效。
- 每次发布前运行 `npm.cmd run verify`；数据模型变更必须附带显式迁移、回滚方案和测试。
- 回退 Worker 代码不能自动回退 D1 数据。变更数据结构前先验证恢复路径。
