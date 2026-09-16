# CF-drive 技术文档

## 架构

项目运行于单个 Cloudflare Module Worker。`worker.js` 同时包含 HTTP 路由、网页 UI、虚拟文件系统、R2 读写、D1 状态层、分享、分布式存储节点和 WebDAV；没有额外后端服务。

```text
浏览器 / WebDAV 客户端
          │ HTTPS
          ▼
     Cloudflare Worker
       ├── R2_BUCKET：文件对象、分片、manifest
       └── DB (D1)：路径映射、目录索引、分享、会话、锁、节点配置
                         │
                         └── 可选外部存储节点 Worker + 独立 R2
```

## 部署依赖与配置

| 类型 | 名称 | 必需 | 用途 |
| --- | --- | --- | --- |
| R2 绑定 | `R2_BUCKET` | 是 | 主控文件对象、manifest 与本节点分片。 |
| D1 绑定 | `DB` | 是 | 虚拟文件系统及全部状态数据。 |
| Wrangler 文本变量 | `BOOTSTRAP_OWNER_PUBLIC_KEY` | 是 | 首次 `/setup` 认领签名验证的 P-256 公钥；不含私钥。 |
| D1 配置 | 管理员密码校验记录、会话/分享签名密钥 | 认领时生成 | 认证和分享；密码不保存原文。 |
| D1 配置 | WebDAV、站点外观、上传上限、受管节点控制端凭据摘要 | 否 | 在实例设置与节点维护页管理。 |

私钥只保留在本地忽略的 `.cf-drive/`；`wrangler.toml` 可以提交，因为仅包含资源绑定和所有者公钥。首次部署由 Cloudflare 自动创建并绑定新的 R2 与 D1，生成的资源 ID 不会写回 GitHub 仓库。

## 数据模型

### R2

- 普通文件保存为独立对象。
- R2 Multipart Upload 完成后写入普通对象。
- 分布式文件在主控 R2 保存 manifest；分片可保存于主控 R2 或外部节点 R2。
- R2 key 不是用户可见路径。对象引用只由 D1 文件记录决定。

### D1

首次请求会创建 `r2drive_kv` 表及过期索引。表按 key/value 存储以下逻辑数据：

| 前缀 | 内容 |
| --- | --- |
| `r2drive:fs:file:` | 文件虚拟路径到对象/manifest 元数据。 |
| `r2drive:fs:folder:` | 显式目录记录。 |
| `r2drive:fs:dir:` | 目录索引；更新时使用比较并交换降低并发覆盖。 |
| `share_link:` | 受控分享记录。 |
| `multipart_session:`、`r2multipart_session:` | 上传会话，默认 24 小时过期。 |
| `r2drive:webdav:lock:` | WebDAV 锁，最长一小时。 |
| `r2drive:rate-limit:` | 登录、分享密码和 WebDAV 认证失败计数。 |
| `storage_nodes`、`storage_node_usage:` | 外部存储节点配置和容量估算。 |
| `backup_dirs:` | 客户端备份目录设置。 |
| `r2drive:app:config:v1` | 实例配置、密码校验记录和 Worker 生成的签名密钥。 |

删除虚拟路径会撤销目标路径及其子路径的分享；移动路径会同步改写其下分享的虚拟路径。对象删除使用 `ctx.waitUntil()` 继续清理 R2 或外部节点分片，因此应结合孤儿扫描和日志进行运营核对。

## 鉴权与安全边界

- 主站在缺少 R2、D1 或所有者公钥时拒绝服务；未认领实例仅开放受所有者签名保护的 `/setup`。
- 管理会话 Cookie 为 `HttpOnly`、`Secure`、`SameSite=Strict`，有效期 7 天，使用 HMAC-SHA-256 签名。
- 所有已登录的危险 HTTP API 请求要求同源：`X-R2Drive-CSRF: same-origin`，或匹配的 `Origin` / `Referer`。
- 登录、分享密码和 WebDAV Basic Auth 在同一来源连续失败 5 次后锁定 15 分钟；D1 仅保存来源地址的 SHA-256 摘要和状态。
- HTML 响应统一设置 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: same-origin` 与受限 `Permissions-Policy`。
- 分享密码、管理密码、WebDAV 密码与每条存储节点连接凭据相互独立、不可复用；管理员与 WebDAV 密码使用 PBKDF2-HMAC-SHA-256、100,000 次迭代的校验记录，并保存迭代参数以支持未来迁移。节点 B 仅保存随机连接凭据的 SHA-256 摘要；控制端 A 保存由外部 `NODE_CREDENTIAL_KEK` 加密的密文。

生产环境仍应在 Cloudflare WAF/Rate Limiting 对 `/api/login`、`/api/share-access` 与 `/dav/*` 加边缘限速。

## 文件与传输流程

- 小文件可通过 `/api/upload` 写入主控 R2。
- 网页端大文件优先走分布式上传；当没有外部节点时仍可由主控 R2 保存分片。分布式初始化只接受大于 512 KiB 的文件。
- R2 Multipart Upload 是网页端分布式上传失败时的回退方案；单块最大 90 MiB，最多 10,000 块。
- 下载支持 Range。分布式下载按 manifest 读取分片，内部范围块默认 32 MiB，可由 `DOWNLOAD_RANGE_SIZE_MB` 调整。

容量页面中的每个节点总容量是界面估算值（默认 10 GiB/节点），不是 Cloudflare 账户配额的权威读数。

## 分享

分享目标是文件或目录的虚拟路径，入口为 `/s/<id>`：

- 后缀限制为 1–64 位小写字母、数字、下划线或短横线，首字符必须是字母或数字；留空会生成随机 ID。
- 支持密码、绝对到期时间或 TTL、下载次数上限。
- 无密码的单文件分享可使用 `/api/share-download` 下载；目录分享经分享页浏览。
- 上限按成功建立的下载会话计数，后续 Range 请求复用下载租约，不重复扣次数。
- 修改密码或后缀会使旧授权失效；刷新链接会生成新 ID 并清零访问计数；撤销后立即不可访问。

## WebDAV

WebDAV 仅在实例 `/settings` 启用且专用用户名、密码都存在时提供服务，入口为 `/dav/`。

| 支持 | 说明 |
| --- | --- |
| `OPTIONS` | 声明可用方法与 DAV Class 1。 |
| `PROPFIND` | 文件支持 Depth 0；目录支持 Depth 0/1。 |
| `GET`、`HEAD` | 支持 Range。 |
| `PUT`、`MKCOL`、`DELETE`、`COPY`、`MOVE` | 映射到同一套虚拟文件系统。 |
| `LOCK`、`UNLOCK` | 排他锁；文件 Depth 0，目录可 Depth infinity，最长一小时。 |
| ETag 条件头 | 写入、删除、复制、移动支持常用 `If-Match` / `If-None-Match` 条件。 |

未实现死属性、`PROPPATCH`、完整 Office/Finder 扩展兼容或 DAV Class 2 声明。上线前必须用目标客户端在隔离目录完成读写、锁和冲突处理验证。

## 外部存储节点

同一份 Worker 可部署为外部节点。控制端 A 与节点 B 通过一次性配对码建立关系：B 生成每关系独立的随机连接凭据并只保存其 SHA-256 校验摘要；A 使用 Cloudflare Worker Secret `NODE_CREDENTIAL_KEK` 以 AES-256-GCM 加密凭据后写入 D1。密文包含节点 ID 绑定的附加认证数据，管理 API 不会返回旧凭据。

B 接入后进入 `managed_node` 模式，仅提供作用域化 `/api/node/*` 分片 API、容量/健康检查和本地 `/node-settings` 应急维护；普通网盘、分享、WebDAV 与孤儿清理不再可用。A 是文件树、分享、manifest 与节点生命周期的唯一控制面。节点分片 key 带控制端实例 ID 前缀，避免多个控制端混用同一 R2 桶。

节点生命周期为 `active → draining → retired`。`draining` 节点不再接收新分片；现有 manifest 仍可读取。删除节点配置前必须确认不存在 manifest 引用，避免旧文件因凭据记录被删除而失联。`STORAGE_NODE_TOKEN` 仅为旧实例兼容保留。

## 测试与维护

```powershell
npm.cmd run verify
```

当前测试覆盖路径规范化、必需密钥安全失败、HTML 安全头、存储节点凭据隔离、旧匿名路径关闭、分享下载次数/Range、改密失效、WebDAV 鉴权、条件请求、锁与基础文件生命周期。

任何数据模型、认证、分享、WebDAV 或节点协议变更，都必须同步更新 API 文档、配置模板、部署文档并补充回归测试。
