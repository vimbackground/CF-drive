# Storage DR facet — RAID/EC、归集迁移与主控晋升

> Run: `k4m7`  
> Facet: storage/data-plane disaster recovery and control-plane promotion  
> Research dimensions: Chinese; technical architecture evaluation; standard depth; low hallucination tolerance; business-grade citation; no paid platform; **Adjudication** mode.  
> Scope boundary: primary/official documentation only. This artifact evaluates feasibility and tradeoffs; it does not prescribe project code changes.

## ClaimCard[]

### k4m7-dr-B1

- `claim_id`: `k4m7-dr-B1`
- `claim`: 最简的单校验纠删码需要 `k=2,m=1` 共 3 个相互独立的存储目标，并可容忍其中 1 个分片目标丢失。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/
- `source_type`: official
- `evidence_kind`: quote
- `evidence`: `The simplest erasure-coded pool has two data chunks (K) and one coding chunk (M). The profile of the simplest erasure-coded pool is “k=2 m=1”.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源明确给出最简 EC 为 2 个数据块加 1 个编码块。由此推断，本项目若采用类似 RAID5 的 `2+1`，至少需要 3 个独立故障域；“存在两个以上受管节点”应明确为至少 3 个实际承载 shard 的故障域，而不能只按 Worker 数量计数。
- `confidence`: high
- `gap`: Ceph 的 OSD/CRUSH 是紧耦合集群机制，而本项目是跨 HTTP 的 Worker/R2 节点；编码、提交、重建与一致性协议仍需项目自行实现。
- `counterquery`: `site:docs.ceph.com erasure coding k=2 m=1 minimum failure domains unavailable degraded`

### k4m7-dr-B2

- `claim_id`: `k4m7-dr-B2`
- `claim`: 纠删码的 `M` 决定可同时丢失的分片目标数，且 failure domain 规则用于避免多个 shard 落入同一故障域。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/
- `source_type`: official
- `evidence_kind`: quote
- `evidence`: `The value of M defines how many OSDs can be lost simultaneously without losing any data. The crush-failure-domain=rack will create a CRUSH rule that ensures no two chunks are stored in the same rack.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源说明冗余能力与故障域隔离是两个同时成立的条件。对本项目的推断是：同一 Cloudflare 账号下的多个 Worker/R2 不能防御“账号被禁用”，账号必须进入 placement policy，副本/编码片应跨账号分布。
- `confidence`: high
- `gap`: Cloudflare 未承诺跨客户账号的联合故障概率；账号级 failure domain 是应用层威胁模型，而非 Cloudflare 原生 R2 配置项。
- `counterquery`: `Cloudflare R2 cross account disaster recovery correlated account failure official`

### k4m7-dr-B3

- `claim_id`: `k4m7-dr-B3`
- `claim`: 纠删码 profile 会固化数据布局；改变 profile 通常需要新建池并搬迁全部对象，说明本项目也应对布局版本化而非原地改变旧 manifest 的编码参数。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/
- `source_type`: official
- `evidence_kind`: quote
- `evidence`: `Choosing the right profile is important because the profile cannot be modified after the pool has been created. If you find that you need an erasure-coded pool with a profile different than the one you have created, you must create a new pool with a different (and presumably more carefully considered) profile.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源谈的是 Ceph pool；项目层推断是将 `layout_version`, `k`, `m`, shard checksum 和 placement 写入每个文件 manifest，旧文件通过显式迁移任务升级，不能因新增节点而偷偷改解释方式。
- `confidence`: high
- `gap`: 具体 manifest 兼容策略需要结合当前项目 schema 审查。
- `counterquery`: `erasure code profile migration object manifest versioning production`

### k4m7-dr-B4

- `claim_id`: `k4m7-dr-B4`
- `claim`: 纠删码比三副本节省空间，但恢复/回填存在明显性能代价，`m=1` 对生产数据尤其脆弱。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://docs.ceph.com/en/umbrella/rados/operations/erasure-code/
- `source_type`: official
- `evidence_kind`: quote
- `evidence`: `Do not mistake erasure coding for a free lunch: there is a significant performance tradeoff, especially when using HDDs and when performing cluster recovery or backfill.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源明确指出恢复/回填代价。项目层推断是 Worker 需要额外编码 CPU、跨节点读取、失败重试和重建流量；因此第一版直接做完整“RAID5”比双副本复杂得多，尤其大文件必须流式编码，不能整体进入 128 MB Worker 内存。
- `confidence`: high
- `gap`: Ceph 性能结论不能量化本项目的 Worker/R2 实际成本；需原型压测编码 CPU、首字节延迟、写放大和重建吞吐。
- `counterquery`: `Cloudflare Workers wasm reed solomon benchmark R2 erasure coding performance`

### k4m7-dr-B5

- `claim_id`: `k4m7-dr-B5`
- `claim`: Cloudflare R2 官方提供 R2 到 R2 的一次性对象复制迁移能力，因此“受控节点内容归集到主控 R2”在平台能力层面可行。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/r2/data-migration/super-slurper/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `Super Slurper allows you to quickly and easily copy objects from other cloud providers to an R2 bucket of your choice.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源说明对象可复制到指定 R2，并在同页列出 Cloudflare R2 为支持的源。对项目的推断是：归集可采用平台批量迁移或应用层逐 shard copy；但项目的 node API、密钥和 manifest 更新仍需自己编排，Super Slurper 不理解项目分片语义。
- `confidence`: high
- `gap`: 未确认 Super Slurper 对本项目跨账号私有 R2 的凭据/权限细节，以及迁移日志能否精确映射到每个 manifest shard。
- `counterquery`: `site:developers.cloudflare.com/r2 Super Slurper Cloudflare R2 source cross account credentials`

### k4m7-dr-B6

- `claim_id`: `k4m7-dr-B6`
- `claim`: 对仍有并发读写的对象集合，Cloudflare 推荐“先按需复制、新写入切到目标、再一次性补齐剩余对象”的低停机迁移顺序。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/r2/data-migration/migration-strategies/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `You can use a combination of Super Slurper and Sippy to effectively migrate all objects with minimal downtime.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源给出 Cloudflare 原生迁移策略。项目层推断是方案 2 可用类似阶段：节点置 draining、停止新分配、复制 shard、校验 checksum、原子切换 manifest、观察期后删源。仅提供一个“归集”按钮而没有状态机、幂等重试和校验，不足以安全删除节点。
- `confidence`: high
- `gap`: Sippy 的源支持范围和项目自定义授权接口是否兼容需要验证；更稳妥的是项目自身 Workflow/Queue 编排。
- `counterquery`: `Cloudflare R2 Sippy R2 source support destination migration consistency deletes`

### k4m7-dr-B7

- `claim_id`: `k4m7-dr-B7`
- `claim`: Cloudflare 建议按 prefix 将迁移拆成独立并行任务，这同时限制单次失败的影响范围。
- `importance`: supporting
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/r2/data-migration/migration-strategies/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `Each prefix runs as an independent migration job, allowing Slurper to transfer data in parallel. This improves total transfer speed and ensures that a failure in one job does not interrupt the others.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源针对 Slurper job。项目层推断是归集任务也应按文件/前缀/批次持久化 checkpoint，并可暂停、恢复和重试，而不是用一个后台 HTTP 请求搬完整节点。
- `confidence`: high
- `gap`: 项目现有 key prefix 是否适合批次迁移需要代码审查。
- `counterquery`: `Cloudflare Workflows R2 batch copy checkpoint retries official`

### k4m7-dr-B8

- `claim_id`: `k4m7-dr-B8`
- `claim`: Cloudflare Workflows 适合长任务，但仍受 CPU 和 subrequest 配额约束；大规模归集必须分步、流式和可恢复。
- `importance`: supporting
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/workflows/reference/limits/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `Because Workflows are long-running and often make many calls to external services or Cloudflare APIs, they can exceed the default subrequest limit.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源说明长流程仍可能超过 subrequest 限制。项目层推断是迁移 orchestration 可放 Workflows/Queues，但每 step 只处理有限 shard，状态写入 D1，数据用流式通道，不把完整对象作为 step result。
- `confidence`: high
- `gap`: 免费/付费计划和本项目对象规模会直接决定批大小，需要容量模型。
- `counterquery`: `site:developers.cloudflare.com/workflows retries step idempotency R2 copy`

### k4m7-dr-B9

- `claim_id`: `k4m7-dr-B9`
- `claim`: D1 Time Travel 是原数据库的时间点恢复，不是可写备用主库；当前官方说明仍不支持通过 Time Travel clone/fork 新数据库。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/d1/reference/time-travel/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `Time Travel does not yet allow you to clone or fork an existing database to a new copy.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源限定了 D1 原生恢复能力。项目层推断是“B 晋升为 A”不能依赖 D1 Time Travel 自动产生新的可写控制面，必须预先把控制面状态导出/同步到可独立恢复的位置，并设计显式 promotion 协议。
- `confidence`: high
- `gap`: D1 新功能可能变化，实施前需重新核验 clone/fork 与跨账号恢复支持。
- `counterquery`: `site:developers.cloudflare.com/d1 clone fork database cross account restore`

### k4m7-dr-B10

- `claim_id`: `k4m7-dr-B10`
- `claim`: D1 全球复制品是异步只读副本，所有写入仍转发到原 primary，因此不能直接承担跨账号主控故障切换。
- `importance`: central
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/d1/best-practices/read-replication/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `All write queries are still forwarded to the primary database instance. Read replication only improves the response time for read query requests.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源直接否定“把读副本提升为项目新主控”的假设。项目层推断是主控转换需要应用级单写者 lease/epoch、冻结旧主写入、复制 D1 逻辑状态、切换入口和重签节点凭据，不能只是互换 UI 中的角色字段。
- `confidence`: high
- `gap`: Cloudflare 是否提供其他跨账号数据库复制产品不在本 facet 范围内。
- `counterquery`: `Cloudflare D1 writable replica promote failover cross account official`

### k4m7-dr-B11

- `claim_id`: `k4m7-dr-B11`
- `claim`: Worker 代码版本可以回滚，但若绑定的 R2/D1 等资源已经不存在，官方回滚也不能恢复服务。
- `importance`: supporting
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `You cannot roll back to a previous version of your Worker if the Cloudflare Developer Platform resources (such as KV and D1) have been deleted or modified between the version selected to roll back to and the version in the active deployment.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源区分了代码版本回滚与持久资源恢复。项目层推断是主控/节点转换不能把 Worker redeploy 当作 DR；资源映射、D1 导出、R2 数据与密钥备份必须独立设计。
- `confidence`: high
- `gap`: 官方文档没有替项目定义跨账号资源恢复流程。
- `counterquery`: `Cloudflare disaster recovery R2 D1 account suspension export restore official`

### k4m7-dr-B12

- `claim_id`: `k4m7-dr-B12`
- `claim`: Cloudflare Service Binding 的目标 Worker 必须位于同一账号，因此不适合作为跨账号容灾节点之间的唯一控制通道。
- `importance`: supporting
- `claim_type`: factual
- `source_url`: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- `source_type`: owner
- `evidence_kind`: quote
- `evidence`: `This Worker must be on your Cloudflare account.`
- `retrieved_at`: `2026-09-16T00:00:00+08:00`
- `source_sha256`: `unavailable`
- `capture_method`: `reader-mode excerpt; the web reader did not expose a persistable full normalized body`
- `source_says_vs_agent_infers`: 来源限制 Service Binding 的账号边界。项目层推断是若防御 Cloudflare 账号禁用，A↔B 应继续使用受认证的公网 HTTPS/自定义域名协议，且 promotion 后需要更新控制端点和凭据；不能依赖只在同账号有效的 binding。
- `confidence`: high
- `gap`: 公网通道的认证、重放防护、证书/域名控制权仍需设计。
- `counterquery`: `Cloudflare cross account Worker to Worker authentication mTLS Access service tokens`

## Feasibility assessment

### 方案 1：类似 RAID5 的容错

**技术上可行，但建议称为“应用层纠删码（EC）”，不要称 RAID5。** RAID5 暗示块设备、固定阵列和本地控制器；本项目实际是跨 HTTP、跨账号的对象 shard。合理的第一种 EC 布局是 `k=2,m=1`，需要 3 个独立 shard 故障域，可容忍 1 个 shard 目标丢失。

对“只有两个节点时不做容灾”的评估：可以作为用户主动选择的低成本模式，但不应作为系统默认的“合格保护状态”。两个节点其实可以做双副本，成本为 2×，实现和恢复远比 EC 简单。建议策略为：

- 1 个存储域：无冗余，后台持续显示高风险；
- 2 个独立存储域：优先双副本，可容忍 1 个节点丢失；若用户拒绝成本，再显式选择无冗余；
- ≥3 个独立存储域：可选 `2+1 EC`；对生产关键数据，需评估 `m=1` 在维护与第二故障重叠时的风险；
- “独立”必须按 Cloudflare 账号/凭据/区域策略计算，不能只数 Worker 实例。

EC 写入不能在“部分成功”后就发布 manifest。至少需要临时 upload generation、各 shard checksum、达到 `k+m` 或策略要求后的原子 commit、失败 shard 清理、读取时的降级重构、节点恢复后的自动 repair，以及 scrub 校验。否则其数据风险可能高于简单双副本。

### 方案 2：受控节点分片归集到主控

**可行，而且应优先于 EC 落地。** 它直接解决计划内退役、账号迁移和容量重整。安全状态机建议为：

`active → draining（停止新分配） → copying → verifying → manifest_switch → observing → retired`

关键约束：

1. 复制源在整个归集与观察期必须保留；
2. 按 shard/文件或 key prefix 分批，任务状态和 checkpoint 持久化；
3. 目标写入后验证长度与加密/内容 checksum；
4. manifest 切换使用版本号或 CAS，避免并发上传/删除覆盖迁移结果；
5. 迁移任务可重复执行且不会重复计费或破坏已完成 shard；
6. 所有受影响 manifest 确认不再引用源节点后，才允许物理删除；
7. 如果 B 已经完全不可访问，归集无法创造缺失数据；它是计划内迁移机制，不替代冗余。

平台的 Super Slurper/Sippy 可做运维辅助，但项目自己的 shard manifest 与节点认证使“应用层迁移任务”仍不可省略。长任务更适合 Workflows/Queues；单个 HTTP Worker 请求不应承担整个节点搬迁。

### 方案 3：主控与受控节点转换

**条件可行，但这是控制面灾备/迁移，不是简单角色互换。** D1 读副本不能晋升为可写主库，Time Travel 也不能直接 clone/fork 成新的 B 主库，所以必须新增应用层 promotion protocol。

最小安全协议应包含：

- 每个集群有稳定 `cluster_id`，每个主控任期有单调递增 `controller_epoch`；
- 正常转换前，旧主控进入 maintenance/read-only，等待上传与迁移事务收敛；
- 将用户、目录、manifest、节点登记、迁移任务与审计记录导出并导入新主控 D1；密钥不应只存在旧账号，需要受控的密钥迁移/重新包裹流程；
- 新主控验证能够读取所管理的所有 shard 后才取得写 lease；受控节点只接受 epoch 最新且签名有效的控制者；
- 更新稳定入口（例如用户自有域名）到新主控，再将旧主控重新 enrollment 为受控节点；
- 新主控运行方案 2，将旧主控 R2 中的分片归集或重新布置；
- 若旧主控已失联，只有事先存在的控制面备份、独立密钥与稳定仲裁规则才能执行灾难晋升。否则只能做人工恢复，不能声称无数据/无一致性损失。

需要明确 split-brain：若 A 与 B 都认为自己是主控并接受写入，D1 与 manifest 会分叉。两节点系统无法在网络分区下同时保证“继续写”和“唯一主控”；本项目应选择安全侧——失去可验证 lease 时只读，而非双主写入。

## Comparative judgment

| 能力 | 可行性 | 建议优先级 | 核心理由 |
|---|---|---:|---|
| 方案 2：归集/退役 | 高 | P0 | 是 EC、节点退役与整体迁移都依赖的基础数据搬运能力；实现边界最清晰 |
| 两节点双副本 | 高 | P1 | 比 `2+1 EC` 简单，可立即覆盖单节点丢失；代价是 2× 存储 |
| ≥3 故障域 `2+1 EC` | 中 | P2 | 节省空间，但上传 commit、重构读取、repair/scrub 与压测成本高 |
| 计划内主控转换 | 中高 | P2 | 有冻结窗口和旧主在线时可控；需完整复制控制面及重签凭据 |
| 旧主失联后的自动晋升 | 中低（当前基础上） | P3 | 必须先有独立控制面备份、密钥托管、epoch/lease 与稳定入口 |

推荐实施顺序是：先做方案 2 的可恢复迁移引擎；再用同一引擎做两节点双副本与 repair；随后才增加 `2+1 EC`；最后建立控制面备份与主控 promotion。这样各阶段都产生独立价值，并避免先实现编码却没有可靠重建/迁移能力。

## Knowledge gaps

- 需要结合当前 manifest/schema 确认 version/CAS 的最小改动和旧文件兼容边界。
- 需要实测 Worker 上 Reed–Solomon/WASM 的 CPU、内存和流式编码可行性；官方资料不足以给出项目级性能结论。
- 需要确定威胁模型：仅防 Worker 误删、同账号 R2/D1 误删，还是明确防整个 Cloudflare 账号封禁。后者要求跨账号且最好跨供应商的备份/副本。
- 需要定义密钥灾备：若节点凭据 KEK 只存在旧主控账号，账号封禁会同时丢失控制面恢复能力。
- Cloudflare 产品能力会变化；实施 D1 clone/fork 或跨账号迁移前应重新核验最新官方文档。

## Negative results / caveats

- 未找到 Cloudflare 官方提供“将 D1 read replica 晋升为另一个账号的可写 primary”的机制；现有官方资料反而明确所有写入仍转发到原 primary。
- 未找到 Cloudflare 原生功能能理解并自动修复本项目自定义 shard manifest；R2 迁移工具只处理对象。
- Ceph 文档用于验证纠删码原理与故障域约束，不意味着 Cloudflare Workers/R2 原生具备 Ceph 的 CRUSH、PG、scrub、recovery 或 backfill 控制面。

