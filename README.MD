# CF-drive

基于 Cloudflare Workers、R2 与 D1 的自托管网盘。它提供网页文件管理、受控分享、可选 WebDAV，以及可扩展的跨账号存储节点与灾备能力。

当前发布版本：**2.1.1**。

## 主要能力

- 文件与目录：上传、下载、预览、排序、批量操作、目录管理与孤儿对象清理。
- 安全分享：密码、有效期、下载次数限制和可撤销的文件/目录分享。
- WebDAV：独立账号与密码、Range、ETag 和基础锁支持。
- 存储节点：一次性配对、加密连接凭据、健康检查、轮换、排空与归集。
- 灾备：Stripe 容量模式、A/B Mirror 双副本、加密恢复快照和人工 B 接管。

## 版本演进

| 阶段 | 内容 |
| --- | --- |
| 1.0 之前 | 原型与功能探索阶段；不作为当前部署或数据迁移基线。 |
| 2.0.0 | 建立全新部署基线：R2 + D1 虚拟文件系统、所有者认领、受控分享、WebDAV、自动发布与回归测试。 |
| 2.1.1（当前） | 修复 B 恢复页登录回跳；灾备操作状态固定显示在页面顶部。 |
| 2.1.0 | 新增多节点 Stripe/Mirror、跨账号恢复快照、人工 B 接管与网页化灾备操作；补齐本地图标映射。 |

完整的升级内容、增加项、修改项与部署注意事项见 [升级记录](./docs/UPGRADE_LOG.MD)。已部署实例可访问 `GET /api/version` 核对运行版本。

## 快速开始

1. 使用 Node.js 20+，运行 `npm.cmd run bootstrap:keygen`，将输出的所有者公钥写入 `wrangler.toml`。
2. 运行验证：

   ```powershell
   npm.cmd run verify
   ```

3. 按 [GitHub + Cloudflare 自动发布教程](./docs/GITHUB_CLOUDFLARE_DEPLOYMENT.md) 部署；首次访问 `/setup`，选择本地所有者私钥并设置管理员密码。

## 文档

- [部署与安全验收](./docs/DEPLOYMENT.md)
- [技术架构与运行边界](./docs/TECHNICAL_DOC.MD)
- [HTTP API 与 WebDAV 参考](./docs/API说明文档.MD)
- [Mirror 恢复快照与 B 接管](./docs/MIRROR_RECOVERY_OPERATION_GUIDE.MD)
- [存储冗余正式方案](./docs/STORAGE_REDUNDANCY_PLAN.MD)
- [升级记录](./docs/UPGRADE_LOG.MD)

## 致谢

本项目的功能方向受到原项目 [HandsomeMJZ/R2-Cloud-Drive](https://github.com/HandsomeMJZ/R2-Cloud-Drive) 的启发，感谢原作者。
