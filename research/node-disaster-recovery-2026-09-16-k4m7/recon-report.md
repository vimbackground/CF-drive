# 节点容灾、归集与主控转换方案评估

## 结论

三个方向都可以实现，但不应按 1→2→3 原样平铺。建议采用组合方案：

1. 先实现方案 2 的可恢复归集/迁移引擎。
2. 两个独立故障域时采用双副本；三个及以上独立故障域时，再允许选择 `2+1` 应用层纠删码。
3. 在控制面可导出、恢复并完成防双主设计后，支持有维护窗口的主控角色转移。
4. 自动故障晋升最后实施；它不是简单的 A/B 模式字段互换。

“独立故障域”必须按 Cloudflare 账号及凭据边界计算，而不是只数 Worker。若 A 和 B 在同一账号，不能防止账号禁用。

## 方案 1：类 RAID5

技术上可行，但更准确的名称是“应用层纠删码”。当前 manifest 每个分片只有一个位置，读取失败也只会重试同一节点，因此需要升级 manifest、上传提交、降级读取、删除、修复、scrub、容量统计和历史数据回填。

- 只有 A 一个存储域：无冗余，高风险。
- A+B 两个独立存储域：建议双副本 RF=2，可容忍任一域丢失。
- A+B+C 至少三个独立存储域：才可采用 `k=2,m=1`，即两份数据 shard 加一份校验 shard。

如果“两个以上受管节点”是指 B、C，再加主控 A，则总计三个故障域，`2+1` 可行；如果总共只有两个参与存储的实例，则不构成 `2+1`。

不建议规定“两节点不做容灾”。这会使系统恰好在最常见的小规模部署中没有保护。可以允许用户主动选择“容量优先、无冗余”，但后台应持续标记为高风险状态。

## 方案 2：节点分片归集到主控

可行性最高，应作为第一优先级。推荐状态机：

`active → draining → copying → verifying → manifest_switch → observing → retired`

每次迁移必须：停止向源节点分配新分片；以 A 的 manifest 为权威逐文件复制；校验长度和内容摘要；用版本/CAS 原子切换 manifest；保留源分片观察一段时间；确认零引用后再删除源对象和节点。

任务需要分批、可暂停、可重试和有持久 checkpoint，不能由一次 HTTP 请求搬完整节点。主控还必须预先检查本地容量是否足够。

该能力解决计划内退役和整体迁移，但不能恢复已经消失的 B。B 已不可访问时，归集无法创造丢失分片，因此它不能替代双副本或 EC。

## 方案 3：主控与受控节点转换

计划内转换可行；原主控失联后的自动晋升，目前基础不足。

当前 B 执行 detach 只会恢复独立模式，不会取得 A 的目录、manifest、分享、管理员配置和其他节点凭据。现有分片 key、nodeId 和连接凭据也绑定原 A→B 方向。

安全转换至少需要：稳定 `cluster_id`；单调递增的 `controller_epoch`；旧主控冻结写入；控制面数据导出/导入；密钥重新包装或轮换；新主控验证所有节点可读；稳定域名切换；旧主控 fencing；最后把旧 A 重新配对为受控节点。

第一版应只支持“计划内主控迁移”，允许短维护窗口。旧 A 已失联时的晋升必须依赖事先存在于独立账号/位置的控制面备份、恢复密钥和人工 break-glass 仲裁，否则容易产生双主和分叉 manifest。

## 推荐实施顺序

- P0：manifest v2、分片摘要、可恢复迁移任务、归集 UI、迁移校验与延迟删源。
- P1：RF=2 双副本、读取自动切换、故障节点 repair；同时支持把旧 v1 文件后台回填为受保护布局。
- P2：在三个以上独立故障域中增加可选 `2+1 EC`，完成流式编码与恢复压测后再开放。
- P2：控制面导出/导入和计划内主控转移，加入 epoch/fencing。
- P3：独立仲裁、控制面持续备份、故障主控人工/自动晋升演练。

## 主要资料

- Cloudflare R2 durability: https://developers.cloudflare.com/r2/reference/durability/
- Cloudflare D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare D1 read replication: https://developers.cloudflare.com/d1/best-practices/read-replication/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Ceph erasure coding: https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/

## 限制

目前可以确定架构依赖与风险，不能在没有原型压测的情况下承诺 EC 编码吞吐、恢复时间或节点归集速度。实施前还需确定典型文件规模、可接受存储开销、RPO、RTO，以及主控 A 是否必须计入数据故障域。

