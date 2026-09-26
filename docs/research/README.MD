# 调研档案说明

`docs/research/archive/` 只保存实施前的结论性调研报告；它们不是部署或运行的权威说明。

## 使用规则

- 日常部署、配置和故障处理应以 `docs/` 根目录的正式手册为准。
- 需要追溯架构取舍或外部资料来源时，再查阅归档调研。
- 调研过程材料（`artifacts/`、`ledger.md`、`manifest.md`、`audit.md`、资料摘录）已清理；需要追溯实现历史时应使用 Git 提交记录。
- 新调研必须直接创建在 `docs/research/archive/<YYYY-MM>/` 下；禁止在仓库根目录创建 `research/`。

## 归档主题

- `bootstrap-security-*`：首次认领与部署安全。
- `cloudflare-github-auto-deploy-*`：Workers Builds 与 GitHub 自动发布。
- `node-governance-*`：受管节点凭据与生命周期治理。
- `node-disaster-recovery-*`：节点归集、镜像容灾和主控转换评估。

当前共保留 5 份结论报告：每个主题的 `recon-report.md`，以及自动发布主题的 `final-report.md`。
