# Claim Ledger

| claim_id | normalized_claim | importance | source_family | locator | status | counterquery |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | 当前 manifest v1 的每个逻辑分片只有一个存储位置，没有副本、校验片或备用读取位置。 | central | owner-code | `worker.js:6106`, `worker.js:7910`, `worker.js:7974` | confirmed | 搜索外部复制层或未入库运维脚本 |
| C2 | 当前节点读取只对同一 URL/key 重试三次，不能切换副本或重构缺失分片。 | central | owner-code | `worker.js:6399`, `worker.js:6463` | confirmed | 搜索代理层是否持有第二份数据 |
| C3 | `draining` 只停止新分配；现有分片迁移/重平衡尚未实现。 | central | owner-code | `worker.js:7569`, `docs/AUDIT.md:27` | confirmed | 无 |
| C4 | A 已有列举、读取、写本地 R2、删除远端分片的低层原语，但没有可恢复迁移事务。 | central | owner-code | `worker.js:6542`, `worker.js:6399`, `worker.js:6525` | confirmed | 核对是否存在隐藏作业表 |
| C5 | 受控节点 detach 只恢复 standalone，不会取得 A 的目录、manifest、分享和节点凭据。 | central | owner-code | `worker.js:7208`, `docs/TECHNICAL_DOC.MD:107` | confirmed | 无 |
| C6 | 当前身份、分片前缀、nodeId 和连接凭据均绑定原 A→B 方向，直接互换角色会失配。 | central | owner-code | `worker.js:4233`, `worker.js:4563`, `worker.js:7908` | confirmed | 无 |
| C7 | 最小单校验 EC 是 2 个数据块加 1 个校验块；容忍一个 shard 目标丢失至少要 3 个独立故障域。 | central | official | https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/ | confirmed | 验证项目原型的 Worker 性能与布局 |
| C8 | EC 的 m 决定可同时丢失的 shard 数；failure-domain 约束必须防止同条带多个 shard 落入同一故障域。 | central | official | https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/ | confirmed | 将账号定义为项目 placement failure domain |
| C9 | EC 节省空间但 recovery/backfill 有显著性能代价，m=1 在维护与重叠故障时脆弱。 | supporting | official | https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/ | confirmed | 需要本项目压测量化 |
| C10 | R2 自身有内部冗余和高持久性，但官方明确区分持久性与可用性，且不防意外删除。 | central | owner | https://developers.cloudflare.com/r2/reference/durability/ | confirmed | 账号封禁属于应用层独立故障边界 |
| C11 | D1 Time Travel 是原数据库的时间点恢复，当前不提供 clone/fork 成新数据库。 | central | owner | https://developers.cloudflare.com/d1/reference/time-travel/ | confirmed | 实施前重新核验产品变化 |
| C12 | D1 read replication 的写入仍回到原 primary，不能直接作为跨账号可写主控晋升。 | central | owner | https://developers.cloudflare.com/d1/best-practices/read-replication/ | confirmed | 搜索未来跨账号可写复制能力 |
| C13 | Worker 长任务受 CPU、内存、子请求和触发器执行边界约束，节点归集必须流式、分批、可恢复。 | supporting | owner | https://developers.cloudflare.com/workers/platform/limits/ | confirmed | 按部署套餐做容量基准 |
| C14 | R2 Bucket Locks 可防对象被意外删除/覆盖，但不能解决账号不可用。 | supporting | owner | https://developers.cloudflare.com/r2/buckets/bucket-locks/ | confirmed | 无 |

## Hypothesis Matrix

### H1 — 容量效率优先：先实现 2+1 EC，再补迁移和控制面切换

- type: decision
- supporting_claim_ids: C7, C8, C9
- contradicting_claim_ids: C1, C2, C3, C4, C13
- discriminator_or_falsifier: Worker 流式 Reed-Solomon 原型在目标分片大小下满足 CPU/内存/吞吐，并且 repair/backfill 能可靠运行。
- status: conditional
- residual_uncertainty: 尚无项目级性能原型；先做 EC 会同时改动所有数据生命周期路径。

### H2 — 分层演进：先迁移引擎和双副本，再选配 EC，最后做受控主控转移

- type: decision
- supporting_claim_ids: C1, C2, C3, C4, C5, C6, C7, C10, C11, C12, C13
- contradicting_claim_ids: C9（双副本空间成本高于 2+1 EC）
- discriminator_or_falsifier: 若目标明确只追求容量、允许无灾备窗口，且双副本成本不可接受，则不应默认 H2 的 RF=2。
- status: active
- residual_uncertainty: 用户尚未给出可接受存储开销、RPO/RTO 与典型文件规模。

### H0 — 只做方案 2 的计划内归集，不提供在线冗余或主控转移

- type: decision
- supporting_claim_ids: C3, C4, C10, C14
- contradicting_claim_ids: C1, C2, C5, C11, C12
- discriminator_or_falsifier: 若威胁模型仅包含计划内节点退役、不包含突发节点或账号失效，则 H0 足够。
- status: conditional
- residual_uncertainty: 与用户前一轮提出的账号禁用灾害场景不匹配。

- matrix_outcome: preferred
- preferred_hypothesis_id: H2

