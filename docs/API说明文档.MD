# CF-drive HTTP API 与 WebDAV 参考

基础地址：`https://<worker-domain>`。除下载、分享页、WebDAV 和节点分片响应外，API 返回 JSON；错误通常形如：

```json
{ "ok": false, "error": "message" }
```

## 通用规则

- 主站管理 API 需要先 `POST /api/login` 获得会话 Cookie。
- 所有有副作用的管理 API 还需要同源校验；程序化调用请带 `X-R2Drive-CSRF: same-origin`。
- 虚拟路径不以 `/` 开头或结尾，不能包含 `.`、`..`、控制字符或空段。
- 主站未配置 R2、D1 或所有者公钥时拒绝服务；未认领实例只开放 `/setup` 与初始化 API。
- `/api/node/*` 不使用管理 Cookie；受管节点使用每条 A↔B 连接独立的 Bearer 凭据，旧 `STORAGE_NODE_TOKEN` 仅兼容既有实例。

## 首次认领与实例设置

首次部署后，打开 `/setup` 并选择本地所有者私钥 JWK 文件。浏览器使用私钥签名，私钥不会上传。初始化成功后设置管理员密码；密码、分享签名密钥、会话签名密钥和 WebDAV 配置保存于 D1。

| 方法与路径 | 认证 | 说明 |
| --- | --- | --- |
| `GET /api/setup/challenge` | 所有者公钥已配置且未认领 | 返回 10 分钟有效的一次性签名挑战。 |
| `POST /api/setup/claim` | 有效 P-256 所有者签名 | `{nonce,signature,password,siteTitle?}`；仅可成功一次。 |
| `GET /settings` | 管理 Cookie | 实例设置界面。 |
| `GET /api/settings` | 管理 Cookie | 返回不含密钥或密码的当前设置。 |
| `PUT /api/settings` | 管理 Cookie + 同源 | 修改站点标题、WebDAV、管理员密码或轮换内部签名密钥。 |

## 认证与管理入口

| 方法与路径 | 认证 | 请求 | 结果 |
| --- | --- | --- | --- |
| `POST /api/login` | 无 | `{ "password": "..." }` | 正确时写入 7 天管理 Cookie；错误密码返回 `{ "ok": false }`。 |
| `POST /api/logout` | 同源 | 无 | 清除管理 Cookie。 |
| `GET /` | 管理 Cookie | `?path=<virtual-path>` 可选 | 返回网盘 HTML；未登录跳转 `/login`。 |
| `GET /api/list` | 管理 Cookie | `?path=` 可选 | `{ "folders": string[], "files": [{name,size,uploaded,etag}] }`。 |
| `GET /api/storage` | 管理 Cookie | 无 | 主控与外部节点容量估算。 |

## 文件与目录

| 方法与路径 | 请求 | 说明 |
| --- | --- | --- |
| `GET` / `HEAD /api/download?path=<path>` | 可带 `Range` | 下载文件；支持普通对象和分布式 manifest。 |
| `POST /api/upload?path=<path>` | 原始文件 body | 小文件直传到主控 R2。 |
| `POST /api/mkdir` | `{ "path": "folder" }` | 新建目录。 |
| `POST /api/rename` | `{ "from": "a", "to": "b" }` | 移动或重命名文件/目录。 |
| `DELETE /api/delete?path=<path>` | 无 | 删除一个文件或目录。 |
| `POST /api/delete-batch` | `{ "paths": ["a", "b"] }` | 批量删除。 |
| `POST /api/orphan-cleanup` | `{ "action": "scan" }` 或 `{ "action": "clean", "keys": [...] }` | 扫描或清理未被 D1 文件记录引用的主控 R2 对象。 |

`rename`、删除和批量删除会处理关联分享；所有有副作用的接口要求管理 Cookie 与同源校验。

## 上传协议

### R2 Multipart Upload

| 方法与路径 | 请求 / 结果 |
| --- | --- |
| `POST /api/multipart/init` | 请求 `{path, contentType?}`；返回 `{key, uploadId}`。 |
| `POST /api/multipart/part?path=&uploadId=&partNumber=` | 原始分片 body；返回 R2 part 描述。 |
| `POST /api/multipart/complete` | 请求 `{path, uploadId, parts}`；完成后写入文件映射。 |
| `POST /api/multipart/abort` | 请求 `{path, uploadId}`；安全中止会话。 |

### 分布式上传

| 方法与路径 | 请求 / 结果 |
| --- | --- |
| `POST /api/distributed/init` | `{path,size,chunkSize,parts,contentType?}`；仅接受大于 512 KiB 的文件，返回 `sessionId`、分片 `uploadUrl` 与分配摘要。 |
| `PUT /api/distributed/main-part?sessionId=&partNumber=&token=` | 向主控 R2 写入一个已授权分片。 |
| `PUT /api/distributed/node-part?sessionId=&partNumber=&token=` | 由主控校验后中继至外部节点。 |
| `POST /api/distributed/complete` | `{ "sessionId": "..." }`；写入 manifest 与文件映射。 |
| `POST /api/distributed/abort` | `{ "sessionId": "..." }`；删除已上传的会话分片。 |

上传 URL 中的分片 token 只属于对应会话和分片，不能复用或保存为长期凭据。

## 剪贴板与复制/移动

| 方法与路径 | 请求 / 结果 |
| --- | --- |
| `GET /api/clipboard?id=<id>` | 返回保存的项目、动作和源路径；默认 ID 为 `default`。 |
| `POST /api/clipboard?id=<id>` | `{items, action: "copy"|"cut", sourcePath}`；保存 24 小时。 |
| `DELETE /api/clipboard?id=<id>` | 清除剪贴板。 |
| `POST /api/clipboard/paste` | `{action, items, sourcePath, targetPath}`；逐项返回 `results`，部分失败时为 HTTP 207。 |

## 分享

| 方法与路径 | 认证 | 请求 / 结果 |
| --- | --- | --- |
| `POST /api/shares` | 管理 | `{path, suffix?, password?, expiresAt?, ttlSeconds?, maxAccesses?}` 创建文件或目录分享。 |
| `GET /api/shares?path=` | 管理 | 列出分享；`path` 可选，返回 `{shares}`。 |
| `PUT /api/shares?id=<id>` | 管理 | 可更新 `suffix`、`passwordMode`（`set`/`clear`）、`password`、`expiresAt`、`ttlSeconds`、`maxAccesses`、`resetAccessCount`。 |
| `DELETE /api/shares?id=<id>` | 管理 | 撤销分享。 |
| `POST /api/shares/refresh` | 管理 | `{id}` 或查询 `id`；生成新链接并重置访问计数。 |
| `GET /s/<id>` | 公开 | 分享页面；目录可加 `?path=<relative-path>`。 |
| `POST /api/share-access` | 同源 | `{id,password}`；密码正确时写入分享访问 Cookie。 |
| `GET` / `HEAD /api/share-download?id=<id>&path=<relative-path>` | 公开/分享 Cookie | 下载单文件或目录分享中的文件；可带 Range。 |

`maxAccesses` 只统计成功创建的 GET 下载会话；同一会话的 Range 重试不会重复消耗额度。无密码文件分享会在管理响应中返回 `downloadUrl`；密码分享必须先通过 `/api/share-access`。

## 存储节点

### 主控管理接口

| 方法与路径 | 请求 / 结果 |
| --- | --- |
| `GET /api/storage-nodes` | 列出节点；响应不返回 token。 |
| `POST /api/storage-nodes/enroll` | `{name,url,enrollmentCode,weight?}`；用 B 生成的一次性配对码接入节点。A 加密保存连接凭据。 |
| `POST /api/storage-nodes` | 兼容旧接口；`{id?,name,url,token,enabled?,weight?}`。仅在已配置 `NODE_CREDENTIAL_KEK` 时可用。 |
| `POST /api/storage-nodes/rotate?id=<id>` | 轮换 A↔B 的独立连接凭据；不返回或查询旧凭据。旧凭据仅保留 10 分钟，以防控制端落库失败造成断连。 |
| `POST /api/storage-nodes/drain?id=<id>` | 停止向节点分配新分片，标记为 `draining`。 |
| `POST /api/storage-nodes/consolidate?id=<id>` | 为已排空节点创建归集作业；返回作业 ID，作业逐分片迁移到主控 R2。 |
| `POST /api/storage-manifests/upgrade` | 创建 v1→v2 manifest 升级作业；成功前保留原 manifest。 |
| `DELETE /api/storage-nodes?id=<id>` | 仅在没有 manifest 分片引用时删除节点配置。 |
| `POST /api/storage-nodes/test?id=<id>` | 检查 ping 与容量接口。 |
| `GET /api/storage-nodes/r2-files?id=main&cursor=&limit=100` | 查看主控或指定节点对象；`limit` 范围 1–200。 |
| `GET /api/storage-policy` | 返回当前存储策略及已实现能力；`mirror.recovery` 仍表示完整接管能力，`mirror.recoverySnapshot` 表示已支持加密快照同步。 |
| `POST /api/storage-policy/convert` | 以 `{targetMode:"mirror",mirrorNodeId,primaryFaultDomain,mirrorFaultDomain,confirm:"MIRROR"}` 进入 Stripe→Mirror 准备；或以 `{targetMode:"stripe",confirm:"STRIPE"}` 从健康 Mirror 进入降级准备。 |
| `POST /api/storage-policy/convert/run` | 根据当前目标模式创建转换作业：Stripe→Mirror 补齐 B 副本；Mirror→Stripe 校验 A 主副本后移除 Mirror placement，并保留旧 B 对象观察期。 |
| `GET /api/storage-jobs` | 列出持久化存储作业及其进度。 |
| `POST /api/storage-jobs/<id>/run` | 执行一个归集分片；复制、分段 SHA-256 校验、切换 manifest 并清理源分片。 |
| `POST /api/storage-jobs/<id>/pause\|resume\|cancel` | 暂停、继续或取消尚未完成的归集作业；取消不会删除源分片。 |
| `POST /api/mirror/scrub` | 创建 Mirror 副本校验作业；摘要或副本布局异常会将策略标记为 `degraded`。 |
| `POST /api/mirror/repair` | 创建 Mirror repair 作业；用主副本重建镜像 placement，校验后以 CAS 替换。 |
| `GET /api/recovery/status` | A 返回恢复公钥登记、集群 ID、快照提交序号及 B 确认序号；`snapshotAcknowledged` 仅表示最后一次手动快照已被 B 确认；B 受管节点仅返回其已保存的恢复包标识和提交序号；不返回公钥内容或任何私钥。 |
| `POST /api/recovery/configure` | 以 `{confirm:"RECOVERY_PUBLIC_KEY",publicKeyJwk}` 登记离线保管的 P-256 ECDH 公钥。重新登记会使旧快照不再可用。 |
| `POST /api/recovery/snapshot` | 仅在 Mirror 为 `healthy` 时生成完整控制面快照，以 ECDH-P256/AES-GCM 加密并同步至固定 B；尚不等同于灾备接管。 |
| `POST /api/recovery/promote` | 仅固定 B 的本地管理员可调用。提交 `{confirm:"PROMOTE",clusterId,privateKeyJwk}` 后，校验并解密恢复包、验证 B 数据/manifest 副本、恢复控制面、撤销 A 的节点控制权限并提升 B。成功后 B 处于降级 Stripe 状态，需重新登录和重建 Mirror。 |

新建 Stripe manifest 使用 `sha256-tree-v1:<hex>`：对每个不超过 8 MiB 的数据段做 SHA-256，再对顺序叶子摘要做根哈希。它避免将完整大分片加载到 Worker 内存，并用于归集前后的数据一致性核验。

### 节点 Worker 接口

受管节点仅接受每条 A↔B 连接独立的 Bearer 凭据，并限制分片 key 至该控制端命名空间。`STORAGE_NODE_TOKEN` 仅保留为旧实例兼容路径：

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/node/ping` | 节点连通性检查。 |
| `GET /api/node/storage` | 返回节点已用量和界面容量估算。 |
| `GET /api/node/r2-list?cursor=&limit=` | 分页列出节点 R2 对象。 |
| `PUT /api/node/part?key=&size=` | 写入一个节点分片。 |
| `GET` / `HEAD /api/node/part?key=` | 读取节点分片，支持 Range。 |
| `DELETE /api/node/part?key=` | 删除节点分片。 |
| `POST /api/node/credential/rotate` | 控制端用现有连接凭据轮换其自身凭据。 |

### 节点本地维护接口

| 方法与路径 | 用途 |
| --- | --- |
| `POST /api/node-admin/enrollment` | 已登录的独立实例创建 10 分钟一次性配对码。 |
| `POST /api/node/enroll` | 控制端使用配对码完成接入；不使用管理 Cookie。 |
| `POST /api/node-admin/detach` | 已登录本地管理员以 `{confirm:"DETACH"}` 撤销控制端凭据并恢复独立模式。 |

## 客户端备份目录设置

这些接口只保存客户端的目录设置，不传输或同步本地文件：

| 方法与路径 | 请求 |
| --- | --- |
| `GET /api/backup-dirs?clientId=<id>` | 读取目录列表。 |
| `POST /api/backup-dirs` | `{clientId, dirs}` 替换完整列表。 |
| `POST /api/backup-dirs/add` | `{clientId, path}` 添加一项。 |
| `DELETE /api/backup-dirs?clientId=<id>&path=<path>` | 删除一项；省略 `path` 清空该客户端列表。 |

## WebDAV

端点为 `/dav/`，使用 Basic Auth，不使用网页管理 Cookie。必须在实例 `/settings` 设置独立用户名、密码并启用。

支持 `OPTIONS`、`PROPFIND`、`GET`、`HEAD`、`PUT`、`MKCOL`、`DELETE`、`COPY`、`MOVE`、`LOCK`、`UNLOCK`。`PROPFIND` 只支持文件 Depth 0、目录 Depth 0/1；锁为排他锁，最长一小时。写请求支持常用 ETag 条件头，发生锁冲突返回 423，条件不满足返回 412。

## 常见状态码

| 状态码 | 含义 |
| --- | --- |
| 400 | 参数、路径、D1 绑定或请求体不合法。 |
| 401 | 管理会话或节点 Bearer Token 缺失/无效。 |
| 403 | 分享密码、CSRF 或 WebDAV 认证失败。 |
| 404 | 目标、上传会话或节点不存在。 |
| 409 | 父目录不存在、上传会话冲突或资源状态冲突。 |
| 410 | 分享已过期或访问次数用尽。 |
| 412 | WebDAV ETag / 覆盖条件不满足。 |
| 413 | WebDAV PUT 超过配置上限。 |
| 423 | WebDAV 路径被锁定。 |
| 429 | 登录、分享密码或 WebDAV 认证尝试过多。 |
| 500 | 主站缺少强制配置或未处理错误。 |
| 502 | 外部存储节点不可用。 |
