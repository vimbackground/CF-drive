# Cloudflare + GitHub 自动部署

本项目使用 Cloudflare Workers Builds 连接 GitHub。完成一次性资源初始化后，每次推送 `main` 都自动执行测试并发布生产 Worker。

```text
git push origin main
        │
        ▼
Cloudflare Workers Builds
  npm run verify
  npx wrangler deploy
        │
        ▼
cf-drive Worker → R2_BUCKET / DB
```

Cloudflare Workers Builds 的 Git 集成、构建命令和生产分支规则以 [Cloudflare 官方文档](https://developers.cloudflare.com/workers/ci-cd/builds/) 为准。

## 一次性初始化

1. 使用 [部署与安全手册](./DEPLOYMENT.md) 创建 R2 桶和 D1 数据库，默认名称均为 `cf-drive`。
2. 将 D1 创建返回的 UUID 写入 `wrangler.toml` 的 `database_id`。
3. 确认 `wrangler.toml` 中的 `name` 为 `cf-drive`，R2 绑定名为 `R2_BUCKET`，D1 绑定名为 `DB`。
4. 提交不含密钥的代码、测试、文档和 `wrangler.toml`：

```powershell
git add worker.js package.json wrangler.toml test README.MD docs
git commit -m "chore: initialize cf-drive deployment"
git push origin main
```

不要提交 `.dev.vars`、`.env`、任何密码、Token 或 Cloudflare API 凭据。

## Cloudflare Dashboard 设置

1. 打开 **Workers & Pages**，选择 **Create application**。
2. 在 **Import a repository** 选择 **Get started**，连接 GitHub。
3. 授权 Cloudflare GitHub App 时选择 **Only select repositories**，仅授权本仓库。
4. 选择仓库并创建 Worker；名称必须为 `cf-drive`。
5. 打开 **Settings > Build**，设置：

| 设置 | 值 |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run verify` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | 关闭 |

Cloudflare 中的 Worker 名称必须与 `wrangler.toml` 的 `name` 一致，否则构建会失败。构建变量只在构建期间可见；`ACCESS_PASSWORD`、`SHARE_SECRET` 等运行时凭据必须在 **Settings > Variables and Secrets** 中设置为 Secret。

## 首次验证

1. 在 Cloudflare 的 **Deployments** 页面确认构建依次完成 `npm run verify` 与 `npx wrangler deploy`。
2. 打开生成的 `workers.dev` 地址，确认主站没有“未完成安全配置”提示。
3. 完成 [部署手册](./DEPLOYMENT.md#6-首次功能验收) 的功能检查。
4. 通过后再添加自定义域名和 WebDAV。

## 日常发布与回退

- 只通过合并/推送 `main` 发布代码；不要在 Dashboard 在线修改 `worker.js`，以免 Git 与生产版本分叉。
- 构建失败时，先检查 Worker 名称、D1 ID、绑定名、必需 Secret 和 `npm run verify` 日志。
- 紧急停止自动生产发布时，在 **Settings > Builds** 断开仓库；历史 Worker 版本会继续运行。
- 回退时在 Worker 的部署/版本历史选择上一版本。代码回退不等于 D1 数据回退；任何数据库结构变更都必须有独立恢复方案。

## 预览分支

默认关闭预览分支，因为当前配置连接生产 R2/D1。若需要预览，先创建独立 R2、D1、Worker 名称和 Secret，再为预览环境建立单独 Wrangler 配置与部署命令；不能让非生产分支写入生产资源。
