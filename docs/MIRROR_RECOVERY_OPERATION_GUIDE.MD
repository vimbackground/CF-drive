# Mirror 恢复快照与 B 接管操作指南

本文适用于已启用跨账号 Mirror 的 CF-drive。它说明当前已实现的人工恢复流程；不替代生产演练，也不承诺自动故障转移或零 RPO。

## 1. 接管前必须具备的条件

- A 与固定 B 位于不同 Cloudflare 账号/故障域，且 B 已作为 A 的受管存储节点登记。
- A 的存储策略为 `mode: "mirror"`、`status: "healthy"`；转换任务、scrub 和 repair 不得处于失败或运行状态。
- 管理员已离线保管 P-256 ECDH 私钥 JWK。该私钥不应写入 Git、D1、Worker 变量或工单。
- A 已登记与该私钥配对的公钥，且 B 已确认最新恢复包。
- 接管前由管理员隔离或确认 A 不可恢复，避免双主。

## 2. 登记恢复公钥（仅在 A 执行一次）

使用 A 管理员会话调用：

```json
POST /api/recovery/configure
{
  "confirm": "RECOVERY_PUBLIC_KEY",
  "publicKeyJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." }
}
```

公钥必须是 P-256 ECDH 公钥，不能带 `d` 私钥字段，也不能使用 ECDSA 的 `sign` 用途密钥。记录响应中的 `fingerprint`，并与离线保管记录核对。

## 3. 生成并核对恢复快照（在 A 执行）

当 Mirror 健康且业务处于可接受的恢复点时，调用：

```text
POST /api/recovery/snapshot
```

响应会返回 `clusterId`、`commitSequence` 和记录数量。随后调用：

```text
GET /api/recovery/status
```

只有 `snapshotAcknowledged: true`，且 `commitSequence` 与 `syncedCommitSequence` 相同，才表示 B 已确认**最后一次手动快照**。它不表示快照之后的写入已自动同步；把 `clusterId` 与快照时间记录到演练/值班记录中。

恢复包使用 ECDH-P256/AES-GCM 加密；B 保存密文，不保存恢复私钥或明文控制面。

## 4. 在 B 上执行人工接管

1. 登录 B 的本地管理员入口。B 仍是受管节点时，普通网盘 API 会受限，但恢复状态和接管 API 可用。
2. 调用 `GET /api/recovery/status`，确认目标 `clusterId` 出现在 B 的 `packages` 列表中，并核对提交序号。
3. 仅在 A 已隔离或确认不可恢复后，提交：

```json
POST /api/recovery/promote
{
  "confirm": "PROMOTE",
  "clusterId": "来自 A 快照状态的集群 ID",
  "privateKeyJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "...", "d": "..." }
}
```

4. 成功响应后，B 会校验恢复包、B 中的普通文件/分布式分片及 manifest，然后恢复目录和分享元数据，清除 A 的节点控制凭据，并增加 `controllerEpoch`。
5. 使用**恢复后的 A 管理员凭据**重新登录 B；原 B 的受管节点登录会话不能继续作为网盘管理员会话使用。
6. 先抽样下载普通文件、分布式文件和分享链接，再将原域名重新绑定到 B。记录切换时间、最后快照时间、验证结果和 DNS 生效时间。

接管后的 B 明确处于降级 Stripe 状态：现有数据可用，但新的受保护 Mirror 写入不会继续，直到管理员建立新的跨账号 Mirror 并完成迁移。

## 5. 当前恢复边界

- 恢复点是管理员手动生成并由 B 确认的完整快照；两次快照之间的控制面变更不保证可恢复。
- 代码会保留 Mirror→Stripe 转换时的 B 旧对象作为观察期副本，但尚未实现自动观察期清理。
- 系统不自动切换 DNS、不自动晋升 B，也不保证旧会话和进行中的上传连续。
- 在完成真实跨账号演练并记录 RPO/RTO 前，不应宣称账号级容灾已经验收。
