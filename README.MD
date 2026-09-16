# CF-drive

## 致谢

本项目的功能方向受到原项目 [HandsomeMJZ/R2-Cloud-Drive](https://github.com/HandsomeMJZ/R2-Cloud-Drive) 的启发，感谢原作者及贡献者。

基于 Cloudflare Workers、R2 与 D1 的单实例网盘。项目以全新部署为目标：R2 保存文件对象，D1 保存虚拟目录、文件映射、分享、上传会话、锁和管理状态。

当前发布版本：`2.0.0`。

## 当前能力

- 网页端文件与目录管理：上传、下载、预览、排序、新建目录、重命名、复制、剪切、粘贴、批量删除和孤儿对象清扫。
- 虚拟文件系统：目录并不依赖 R2 key 前缀，文件路径、目录索引和对象引用由 D1 维护。
- 大文件传输：网页小文件直传；大文件可使用 R2 Multipart Upload 或分布式分片上传；下载支持 HTTP Range。
- 管理分享：文件和目录可创建可自定义后缀、密码、过期时间、下载次数上限的 `/s/<id>` 分享；可编辑、刷新、撤销和集中管理。
- 多存储节点：主控 Worker 可将大文件分片分配到自身 R2 与外部节点，并查看节点连通性、容量和对象列表。
- WebDAV：可选择性启用 `/dav/`，支持常用读写、目录、复制/移动、Range、ETag 条件请求和排他锁。
- 安全基线：主站要求 R2、D1 与部署所有者公钥；首次认领后，密码校验记录、签名密钥和运行配置均由 D1 管理。

## 不包含的兼容能力

这是一个新部署基线，不迁移或兼容旧 KV 元数据、旧分享密码格式、固定公开目录或匿名管理端。请使用新的 R2 桶与 D1 数据库，不要把旧实例的数据资源接入本项目。

## 快速开始

Worker 名称为 `cf-drive`。首次 GitHub 部署会自动创建并绑定新的 R2 桶与 D1 数据库；资源名称由 Cloudflare 生成，均以 `cf-drive` 为前缀。

1. 运行 `npm.cmd run bootstrap:keygen`。私钥会保存在 Git 忽略的 `.cf-drive/bootstrap-owner-private.jwk`；将命令输出的公钥行写入 `wrangler.toml`。
2. 执行本地验证：

```powershell
npm.cmd run verify
```

3. 按 [Cloudflare + GitHub 自动部署教程](./docs/GITHUB_CLOUDFLARE_DEPLOYMENT.md) 连接仓库并推送 `main`。首次成功部署后，打开 `/setup`，选择本地私钥并设置管理员密码。

完整的资源、密钥和功能验收步骤见 [部署与安全手册](./docs/DEPLOYMENT.md)。

## WebDAV

WebDAV 默认关闭。完成网页端和分享功能验收后，在实例后台 `/settings` 设置独立用户名、密码并启用。入口为：

```text
https://<你的域名>/dav/
```

WebDAV 凭据不得复用管理员密码；详情与兼容范围见 [技术文档](./docs/TECHNICAL_DOC.MD#webdav)。

## 文档

- [部署与安全手册](./docs/DEPLOYMENT.md)
- [Cloudflare + GitHub 自动部署教程](./docs/GITHUB_CLOUDFLARE_DEPLOYMENT.md)
- [技术架构与运行边界](./docs/TECHNICAL_DOC.MD)
- [HTTP API 与 WebDAV 参考](./docs/API说明文档.MD)
- [当前代码审计基线](./docs/AUDIT.md)

## 项目结构

```text
.
├── worker.js                         # Worker、网页 UI、HTTP API、WebDAV
├── wrangler.toml                     # 不含密钥；声明自动创建的 R2/D1 绑定
├── tools/generate-bootstrap-owner-key.mjs # 本地所有者密钥生成工具
├── package.json                      # 本地检查和测试脚本
├── test/worker.test.mjs              # Node 内置回归测试
├── version.json                      # 发布版本清单，不参与运行时远程检查
├── docs/                             # 使用、部署、运维与审计文档
│   ├── DEPLOYMENT.md                 # 新部署与安全验收
│   ├── GITHUB_CLOUDFLARE_DEPLOYMENT.md # Git 自动发布
│   ├── TECHNICAL_DOC.MD              # 架构与维护说明
│   ├── API说明文档.MD                 # API/WebDAV 参考
│   ├── AUDIT.md                      # 当前审计基线
│   └── research/                     # 决策与调研留档
```

## 验证

```powershell
npm.cmd run verify
```

该命令执行 `worker.js` 语法检查和 Node 内置回归测试。提交和发布前应保持通过。
