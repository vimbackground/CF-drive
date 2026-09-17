# 存储冗余后续工作交接

更新日期：2026-09-17

## 当前可用状态

双模式存储的代码实现已完成到“代码验证的人工接管”边界：

- Stripe：manifest v2、节点归集、暂停/继续/取消和 v1 升级。
- Mirror：分布式、普通及 multipart 文件的双写；B 回退读取；scrub、repair；Stripe→Mirror 与 Mirror→Stripe 持久作业。
- 恢复：A 使用管理员离线保管的 P-256 ECDH 公钥加密完整控制面快照，B 只保存密文；B 管理员可用私钥和 `PROMOTE` 确认接管。
- 接管后：B 校验恢复包、普通文件副本、分布式分片与 manifest，清除 A 的受管节点控制权限，增加 `controllerEpoch`，恢复为降级 Stripe 主控。必须使用恢复后的管理员凭据重新登录，并重新建立 Mirror。

操作步骤见 [Mirror 恢复快照与 B 接管操作指南](MIRROR_RECOVERY_OPERATION_GUIDE.MD)。架构与实施边界见 [正式方案](STORAGE_REDUNDANCY_PLAN.MD)。

## 最近提交

- `ab37b82 fix: clarify recovery snapshot acknowledgement`
- `9904c8d docs: add mirror recovery operation guide`
- `dab8962 feat: convert mirror policy back to stripe`
- `fec4db2 feat: promote verified recovery standby`
- `8bcd5ac feat: mirror regular file writes and migrations`
- `99aff7c feat: replicate mirror manifests to standby`
- `2b7878c feat: sync encrypted recovery snapshots to mirror node`

## 验证证据与限制

最后一次验证命令：

```text
npm.cmd run verify
```

结果：21/21 通过，覆盖恢复包密文保存、B 接管、普通文件和分布式文件恢复读取，以及 Mirror→Stripe 转换。

这些是内存式 D1/R2 与 Worker 路由回归测试；尚未在两个真实 Cloudflare 账号、真实 DNS 绑定和实际 R2/D1 故障条件下演练。因此不能宣称账号级容灾已验收。

## 重要运行边界

- `snapshotAcknowledged: true` 只表示 B 已确认**最后一次手动快照**，不表示之后的写入已同步，也不代表零 RPO。
- B 接管是人工操作，前提是管理员已隔离或确认 A 不可恢复；系统不会自动选主或自动切换 DNS。
- Mirror→Stripe 仅去除逻辑副本 placement，B 的旧对象会保留为观察期数据；尚未实现自动到期清理。
- 私钥不得写入 Git、D1、Worker 变量、日志或文档；仅将公钥提交给 `/api/recovery/configure`。

## 下一会话的优先任务

1. 制定并执行真实 A/B 跨账号灾备演练：创建最新快照、隔离 A、在 B 接管、抽样验证普通/分布式文件和分享链接、再绑定域名，记录 RPO/RTO 和 DNS 生效时间。
2. 在获得对“每个可见事务”的提交边界和 RPO 目标确认后，设计并实现控制面增量日志与自动同步。当前手动快照不能直接改称为自动保护。
3. 与管理员确定 Mirror→Stripe 观察期时长及删除授权后，实现旧 B 副本的审计化清理任务。
4. 如需面向非技术管理员操作，再为恢复公钥登记、快照、接管和转换作业补充后台 UI；当前能力以 API 和操作指南交付。

## 工作区注意事项

本次交接时，`README.MD` 与 `CF-drive.code-workspace` 为用户本地未提交改动，后续工作不得覆盖或提交它们，除非用户明确要求。
