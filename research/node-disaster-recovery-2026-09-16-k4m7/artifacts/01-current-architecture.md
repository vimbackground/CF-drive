# 当前实现约束与三类方案可行性

## 范围与结论摘要

本产物只以当前仓库实现为证据，不评价 Cloudflare 产品本身的外部能力。

- “类似 RAID5”不是在现有分片分配器上增加一个开关即可完成。当前模型是每个逻辑分片只指向一个存储位置，没有条带组、校验分片、副本集合、降级读取、重建或后台修复状态机。可实现，但属于 manifest、上传提交、下载、删除、容量核算和运维面的协议升级。
- “将受控节点分片归集到主控”与当前单一控制面最相容，且现有代码已有枚举、读写、删除和 `draining` 的部分原语；但没有复制/校验/原子切换/断点续传的迁移任务。该方案工程风险显著低于纠删码，可作为首选的节点退役与灾备基础能力。
- “主控/受控角色转换”在概念上可行，但当前没有晋升、降级、控制面元数据迁移、写入冻结或防脑裂机制。仅调用受控节点的 `detach` 会把它变成独立实例，却不会带来原主控的文件树、manifest、分享和节点凭据，因此不能算主控切换。

## ClaimCards

### k4m7-code-A1 — 当前分片不是副本或纠删码条带

- status: confirmed
- importance: central
- claim: 当前分布式上传为每个逻辑分片选择且只记录一个节点；manifest v1 的每个 `part` 只有一个 `storageType/nodeId/nodeUrl/key` 定位，不存在副本数组、数据/校验角色、条带 ID 或校验参数。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:6106-6150`：`allocateDistributedParts` 对每个 `partSizes[i]` 只向结果加入一个节点。
  - `D:\Cloud\github\CF-drive\worker.js:7910-7929`：每个 part 只构造一个目标及一个上传 URL。
  - `D:\Cloud\github\CF-drive\worker.js:7974-7990`：manifest v1 每个 part 只固化单一位置字段。
- source_says_vs_agent_infers:
  - source_says: 分配、会话和 manifest 均为一分片一位置。
  - agent_infers: 任一唯一分片所在节点永久不可访问时，当前 manifest 无法从其他节点恢复该字节范围；实现 RAID5 类容错必须升级数据模型和所有生命周期路径。
- confidence: high
- gaps: 未见 manifest schema 迁移器；也未见对历史 manifest 的版本分派。
- counterqueries: 是否存在未纳入仓库的外部复制层、R2 桶级复制或运维脚本；若存在，应单独核验其一致性与恢复流程。

### k4m7-code-A2 — 当前下载只有同一位置重试，没有降级重构或副本切换

- status: confirmed
- importance: central
- claim: 节点分片读取最多对同一个 `nodeUrl/key` 重试三次，随后使输出流报错；读取路径没有备用位置选择，也没有由其他分片计算缺失内容的逻辑。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:3832-3837`：下载节点重试次数固定为 3，manifest 版本为 1。
  - `D:\Cloud\github\CF-drive\worker.js:6366-6385`：每个 manifest part 只解析为一个主 R2 或一个节点凭据。
  - `D:\Cloud\github\CF-drive\worker.js:6399-6416`：三次请求均使用同一 `part.nodeUrl` 和 `part.key`。
  - `D:\Cloud\github\CF-drive\worker.js:6463-6503`：分片读取失败直接令下载流 `controller.error(err)`。
- source_says_vs_agent_infers:
  - source_says: 当前只有同目标瞬态重试，读取错误终止下载。
  - agent_infers: 这能覆盖短暂网络异常，不能覆盖节点/账号故障；RAID5 类方案需新增 degraded read、校验验证和重构读取。
- confidence: high
- gaps: 测试集没有模拟分片节点失效后的完整文件读取。
- counterqueries: 搜索未来分支或部署层是否实现反向代理级重试不会改变“无第二份数据”的事实，但可能改变瞬态错误表现。

### k4m7-code-A3 — 三个物理节点仅能承载最小单故障校验组，但现有语义不支持

- status: confirmed current-state; feasibility is architectural inference
- importance: central
- claim: 若“两个以上受管节点”指至少两个 B 节点，再加主控 A，共三个独立存储故障域，则理论上可以设计最小的两数据一校验条带；若只计算两个受管节点而排除 A，则仅有两个参与节点不能形成常规单校验、仍容忍任一节点丢失的两数据一校验布局。当前实现不校验节点数量，也不保证同一条带落在不同故障域。
- source: local source code plus explicit architecture inference
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:7897-7908`：候选集由主控节点和所有可用受控节点组成，随后逐 part 普通分配。
  - `D:\Cloud\github\CF-drive\worker.js:6110-6147`：按可达性和容量评分逐分片选择，未建立固定条带组，也没有“本条带不得重复节点”的约束。
- source_says_vs_agent_infers:
  - source_says: A 参与普通分片分配；选择算法按容量负载，不表达 failure domain 或 parity。
  - agent_infers: 方案 1 必须先明确节点计数是否包含 A。最小可用规则应写成“至少 3 个独立故障域参与一个条带”，而不是模糊的“两个以上受管节点”；否则可用性承诺会与布局不一致。
- confidence: high for current code; medium-high for the proposed topology interpretation
- gaps: 用户尚未明确 A 是否必须参与校验组，以及期望容忍的是一个 Worker、一个账号还是一个地理区域故障。
- counterqueries: 明确 failure domain 定义、A 是否计入、期望 k+m、容量开销和小文件策略。

### k4m7-code-A4 — RAID5 类能力是协议升级而非局部补丁

- status: inferred from confirmed code paths
- importance: central
- claim: 实现纠删码至少要同时改变上传提交条件、manifest schema、范围下载、删除/覆盖、容量统计、故障节点重建、历史数据回填与验证；遗漏任一路径都会产生不可恢复数据或泄漏对象。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:7968-8008`：当前 complete 直接将会话 parts 写成 manifest，没有校验片生成与最小成功数判断。
  - `D:\Cloud\github\CF-drive\worker.js:6517-6538`：删除按 manifest 中单一 part 逐一删除。
  - `D:\Cloud\github\CF-drive\worker.js:5992-6020`：节点用量按单一 `nodeId` 聚合。
  - `D:\Cloud\github\CF-drive\worker.js:6201-6218`：引用保护只检查 `manifest.parts[].nodeId`。
- source_says_vs_agent_infers:
  - source_says: 完成、读取、删除、引用检测和容量统计均以现有单位置 part 为基本单位。
  - agent_infers: 应引入新 manifest 版本并保持 v1 只读兼容；不能原地改变 v1 语义。Worker 内同步完成大文件编码/重建还需要单独验证执行资源边界。
- confidence: high
- gaps: 尚未测量目标文件大小、分片大小、CPU/内存预算与批处理平台；无法仅凭代码给出吞吐承诺。
- counterqueries: 对目标规模做编码原型和 Worker 资源基准；确定旧 v1 文件是保持无容灾还是后台回填成新版本。

### k4m7-code-A5 — 当前已有归集所需的低层原语，但没有迁移事务

- status: confirmed
- importance: central
- claim: A 已能列举受控节点命名空间、按 key 读取节点分片、向主控 R2 写对象并删除远端分片；然而没有将这些原语组合成可恢复的“复制→校验→切换 manifest→删除源”任务。
- source: local source code and API documentation
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:6542-6588`：经控制端凭据可访问受控节点的容量和带前缀对象列表。
  - `D:\Cloud\github\CF-drive\worker.js:6399-6418`：A 可按 Range 读取受控节点分片。
  - `D:\Cloud\github\CF-drive\worker.js:6388-6396`：已有主控 R2 分片读取；分布式上传另有主控 R2 写入路径。
  - `D:\Cloud\github\CF-drive\worker.js:6525-6536`：A 可删除受控节点分片。
  - `D:\Cloud\github\CF-drive\docs\AUDIT.md:27`：明确记载现有分片迁移/重平衡尚未实现。
- source_says_vs_agent_infers:
  - source_says: 远端列表、读、删和主控 R2 操作原语存在；文档明确迁移尚未实现。
  - agent_infers: 方案 2 可在不改变控制权模型的前提下实现，主要新增后台作业及 manifest 原子替换；它比纠删码更贴合当前架构。
- confidence: high
- gaps: 代码没有内容哈希字段、迁移日志、作业租约、幂等 checkpoint、失败回滚或并发覆盖协调。
- counterqueries: 验证 D1 是否已有可复用作业表；确定迁移中允许文件只读还是需支持并发覆盖/删除。

### k4m7-code-A6 — `draining` 仅停写和删除保护，不会归集

- status: confirmed
- importance: central
- claim: 将节点设为 `draining` 只会设置 `enabled:false` 并停止新分配；删除接口扫描主控 R2 manifest，发现引用即拒绝。当前没有自动将引用迁往 A 的执行路径。
- source: local source code and documentation
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:4049-4050`：默认只返回 enabled 且 active 的节点供分配使用。
  - `D:\Cloud\github\CF-drive\worker.js:7569-7576`：drain 只修改状态。
  - `D:\Cloud\github\CF-drive\worker.js:7579-7589`：存在 manifest 引用时删除返回 409。
  - `D:\Cloud\github\CF-drive\docs\TECHNICAL_DOC.MD:109`：文档定义 `active → draining → retired`，现有引用仍读取。
- source_says_vs_agent_infers:
  - source_says: drain 后旧分片原地保留，删除受引用节点被阻止。
  - agent_infers: 方案 2 的合理落点是把 drain 扩展成显式迁移作业，而不是改变 drain 本身为一次长请求；完成且校验后才允许 retired/delete。
- confidence: high
- gaps: 未定义“归集完成”的持久状态与 UI 进度。
- counterqueries: 确认是否允许按文件逐个完成（中间状态混合 A/B）以及所需暂停、重试、取消语义。

### k4m7-code-A7 — 归集需以 manifest 为权威集合，不能仅遍历 B 的对象

- status: inferred from confirmed code
- importance: central
- claim: 迁移应由 A 扫描其 manifest 引用并按文件重写，而不能只遍历 B 对象后复制，因为文件路径、顺序、大小和有效引用关系由 A 的 manifest/D1 控制，B 的列表只是带控制端前缀的物理对象集合，可能包含孤儿或会话残留。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:7974-8005`：A 的 manifest 和文件映射定义逻辑文件及分片顺序。
  - `D:\Cloud\github\CF-drive\worker.js:5886-5938`：现有孤儿判断会从文件映射与 manifest 收集引用 key，说明物理对象列表不等同于逻辑文件集合。
  - `D:\Cloud\github\CF-drive\worker.js:6578-6588`：B 的列表 API 只返回对象 key、size、uploaded。
- source_says_vs_agent_infers:
  - source_says: 逻辑文件信息在 A，B 只提供对象清单。
  - agent_infers: 迁移算法应为每个 manifest 建立新主控 part，验证长度/哈希后原子替换该 manifest，再延迟回收旧 B part；这样失败时旧 manifest 仍可读。
- confidence: high
- gaps: 当前 manifest 无内容哈希；只能先以完整读取、长度和写后读取校验作为最低保障，或升级 schema 增加摘要。
- counterqueries: 确定哈希算法、校验发生位置及迁移后旧副本保留期。

### k4m7-code-A8 — 当前 `detach` 不是主控晋升

- status: confirmed
- importance: central
- claim: 受控节点执行 `detach` 只把自身 `instanceMode` 改为 `standalone` 并清空 controller 记录；它不会导入原 A 的文件系统元数据、manifest、分享、用户配置或其他节点凭据。因此 B 虽恢复普通网盘入口，也不是 A 的接管者。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:7208-7218`：detach 只改变本地模式/控制器数组，并明确共享分片仍留在 R2。
  - `D:\Cloud\github\CF-drive\worker.js:7142-7151`：`managed_node` 模式只是路由层禁用普通管理 API。
  - `D:\Cloud\github\CF-drive\worker.js:4517-4546`：每个实例的 app config 存放于自己的 D1 KV。
  - `D:\Cloud\github\CF-drive\docs\TECHNICAL_DOC.MD:107`：A 被定义为文件树、分享、manifest 与节点生命周期的唯一控制面。
- source_says_vs_agent_infers:
  - source_says: 模式切换是本地配置变化；全局元数据权威仍在 A。
  - agent_infers: 方案 3 必须先实现“控制面状态包/复制”，再实现晋升；不能以 detach 作为角色转换原语直接复用。
- confidence: high
- gaps: 没有控制面导出/导入格式，也没有跨实例元数据版本或迁移校验。
- counterqueries: 明确切换目标是计划内迁移还是 A 已故障的灾备接管；两者需要不同的一致性与授权设计。

### k4m7-code-A9 — 角色反转受稳定身份和凭据方向约束

- status: confirmed current-state; risk is architectural inference
- importance: central
- claim: 每个实例在本地 D1 保存随机 `instanceId`；A 用其 ID 给 B 的分片加命名空间，B 以 controller ID 校验凭据，A 又按 B 的 instance ID 保存节点和解析 manifest。直接交换角色会使旧分片命名空间、manifest 的 nodeId 和凭据方向与新关系不匹配。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:4517-4530` 与 `D:\Cloud\github\CF-drive\worker.js:4672-4685`：实例 ID 在各自 D1 中生成并持久化。
  - `D:\Cloud\github\CF-drive\worker.js:4563-4590`：B 按 controllerId 建立凭据记录，配对返回 B 自身 instanceId 作为 nodeId。
  - `D:\Cloud\github\CF-drive\worker.js:6160-6171`：B 通过本地 controller tokenHash 鉴权。
  - `D:\Cloud\github\CF-drive\worker.js:7908-7924`：分片 key 使用控制端 instanceId 前缀，manifest part 使用存储节点 instanceId。
  - `D:\Cloud\github\CF-drive\worker.js:6366-6384`：下载时按 manifest `nodeId` 查找 A 保存的节点凭据。
- source_says_vs_agent_infers:
  - source_says: 身份、对象命名空间、manifest 节点引用和链接凭据是定向的 A→B 关系。
  - agent_infers: 角色反转必须保留稳定实例身份并重新签发双向关系，或在迁移时系统性重写 manifest/对象命名空间；不能只对两个实例分别改 `instanceMode`。
- confidence: high
- gaps: 未定义实例身份备份/恢复；也没有节点别名或旧 nodeId 到新角色的映射层。
- counterqueries: 确认是否接受迁移期间重新上传/复制所有分片；若不接受，需要兼容旧命名空间的读取授权设计。

### k4m7-code-A10 — 角色反转缺少防脑裂和写入切换协议

- status: inferred from confirmed routing and metadata model
- importance: central
- claim: 当前没有 promotion epoch、leader lease、fencing token、只读闸门或切换事务。若 A 与 B 的角色修改非原子完成，可能出现两个 standalone 管理端或一段时间没有权威控制端，进而产生分叉元数据或不可达数据。
- source: local source code
- evidence:
  - `D:\Cloud\github\CF-drive\worker.js:7142-7151`：是否提供管理 API 完全由本地 `instanceMode` 判断。
  - `D:\Cloud\github\CF-drive\worker.js:7208-7218`：本地管理员可独立 detach，未与 A 进行协调提交。
  - `D:\Cloud\github\CF-drive\worker.js:4568-4575`：B 只阻止被不同 controller 再次配对，不是全局领导权协议。
  - `D:\Cloud\github\CF-drive\test\worker.test.mjs:166-203`：现有端到端测试覆盖配对、B 禁用普通 API、错误 token 和重定向，但不覆盖角色切换或并发写 fencing。
- source_says_vs_agent_infers:
  - source_says: 模式由各实例本地 D1 独立保存，已有测试只验证单向 A 控 B。
  - agent_infers: 计划内角色反转至少需要 prepare/freeze、完整状态复制与校验、单调 epoch 切换、旧 A fencing、重新配对节点和最终解冻；故障接管还需独立仲裁或人工 break-glass，不能承诺自动无脑裂。
- confidence: high
- gaps: 未确定是否要求零停机；没有统一身份提供者或外部仲裁存储。
- counterqueries: 明确可接受维护窗口、RPO/RTO，以及旧 A 恢复上线时如何证明其不再拥有写权。

## 针对三个方案的当前代码侧判定

| 方案 | 可行性 | 当前复用程度 | 主要阻塞 | 建议定位 |
|---|---|---:|---|---|
| 类 RAID5 容错 | 技术上可行，但为高复杂度协议升级 | 低 | 无校验编码、条带/副本 schema、降级读、重建、回填与故障域约束 | 后续高级容量效率选项，不宜作为第一阶段灾备 |
| B 分片归集到 A | 可行，且最贴近现有架构 | 中 | 无持久迁移作业、校验摘要、manifest 原子切换和失败恢复 | 第一优先级；作为安全退役、缩容、迁移的基础 |
| A/B 角色反转 | 计划内迁移可行；故障接管复杂度更高 | 低至中 | 控制面元数据迁移、身份/凭据重建、防脑裂、写入冻结、其他节点重新归属 | 在归集能力和控制面导出/导入之后实施 |

## 建议的实现依赖顺序（仅架构判断）

1. 先实现可恢复的节点归集：`active → draining → migrating → retired`，以 manifest 为迁移单位，复制到 A、校验、原子切换、延迟删源。
2. 增加 manifest 新版本与每个物理分片摘要，为迁移验证、复制容错和未来纠删码共用。
3. 增加控制面导出/导入、稳定实例身份备份、迁移 epoch 和旧主控 fencing，先支持有维护窗口的计划内 A→B 主控迁移。
4. 在明确三个以上独立故障域、性能预算和恢复作业平台后，再决定采用全副本还是 k+m 纠删码；不要把“节点数达到 3”本身等同于已经具备容灾。

