# CF-drive HTTP API 与 WebDAV 参考

基础地址：`https://<worker-domain>`。除下载、分享页、WebDAV 和节点分片响应外，API 返回 JSON；错误通常形如：

```json
{ "ok": false, "error": "message" }
```

## 通用规则

- 主站管理 API 需要先 `POST /api/login` 获得会话 Cookie。
- 所有有副作用的管理 API 还需要同源校验；程序化调用请带 `X-R2Drive-CSRF: same-origin`。
- 虚拟路径不以 `/` 开头或结尾，不能包含 `.`、`..`、控制字符或空段。
- 主站未配置 R2、D1、`ACCESS_PASSWORD` 或 `SHARE_SECRET` 时拒绝服务。
- `/api/node/*` 不使用管理 Cookie，使用 `Authorization: Bearer <STORAGE_NODE_TOKEN>`。

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
| `POST /api/storage-nodes` | `{id?,name,url,token,enabled?,weight?}` 新增或更新节点。 |
| `DELETE /api/storage-nodes?id=<id>` | 删除节点配置。 |
| `POST /api/storage-nodes/test?id=<id>` | 检查 ping 与容量接口。 |
| `GET /api/storage-nodes/r2-files?id=main&cursor=&limit=100` | 查看主控或指定节点对象；`limit` 范围 1–200。 |

### 节点 Worker 接口

所有接口带 `Authorization: Bearer <STORAGE_NODE_TOKEN>`：

| 方法与路径 | 用途 |
| --- | --- |
| `GET /api/node/ping` | 节点连通性检查。 |
| `GET /api/node/storage` | 返回节点已用量和界面容量估算。 |
| `GET /api/node/r2-list?cursor=&limit=` | 分页列出节点 R2 对象。 |
| `PUT /api/node/part?key=&size=` | 写入一个节点分片。 |
| `GET` / `HEAD /api/node/part?key=` | 读取节点分片，支持 Range。 |
| `DELETE /api/node/part?key=` | 删除节点分片。 |

## 客户端备份目录设置

这些接口只保存客户端的目录设置，不传输或同步本地文件：

| 方法与路径 | 请求 |
| --- | --- |
| `GET /api/backup-dirs?clientId=<id>` | 读取目录列表。 |
| `POST /api/backup-dirs` | `{clientId, dirs}` 替换完整列表。 |
| `POST /api/backup-dirs/add` | `{clientId, path}` 添加一项。 |
| `DELETE /api/backup-dirs?clientId=<id>&path=<path>` | 删除一项；省略 `path` 清空该客户端列表。 |

## WebDAV

端点为 `/dav/`，使用 Basic Auth，不使用网页管理 Cookie。必须同时配置 `WEBDAV_ENABLED=true`、`WEBDAV_USERNAME` 和 `WEBDAV_PASSWORD`。

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
