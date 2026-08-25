# 自托管部署笔记（个人参考）

本文档记录 shici-hub 云同步后端的实际部署方式、日常运维与备份策略。它是维护者笔记，不属于面向用户的功能文档；正式部署说明见 `README.md`「云端同步后端」一节。

## 当前生产部署

| 项目 | 值 |
|---|---|
| 主机 | openclaw（本机 systemd user service） |
| 服务名 | `shici.service` |
| 入口命令 | `server.py --data-dir /home/og/.local/share/shici-data` |
| 部署目录 | `/home/og/shici-memory`（静态文件 + server.py，从仓库检出拷贝而来） |
| 源码仓库 | `~/workspace/shici-hub`，合并分支为 `main` |
| 访问入口 | tailnet 内 `http://openclaw.ts.net:8765/` |
| 数据目录 | `/home/og/.local/share/shici-data/state.json`（本机盘，勿放网络文件系统） |

要点：

- 端口绑定 Tailscale IPv4（server.py 默认行为），外网不可达、流量经 WireGuard 加密。**不要**用 `tailscale serve` / Funnel 或公网端口暴露它。
- 服务由 systemd user unit 拉起，开机自启；改代码后需同步文件到部署目录并 `systemctl --user restart shici`。
- **已知待办**：`SHICI_SHARED_SECRET` 尚未设置，PUT/DELETE 在 tailnet 内无鉴权（启动日志有告警）。tailnet 内目前只有本人设备，风险可控；如需收紧，在 unit 的 `Environment=` 中设置后重启服务即可，前端无需改动。

## 同步语义速记

- 数据模型：单一 JSON 文档 `{rev, savedAt, state}`，`state` 即原 localStorage 里的整份学习记录。
- 首启探测（bootstrap）：GET `/api/state` → 404 时用本机 seed；200 时**采用云端版本覆盖本机**。
- 常规保存：每次改动 PUT `{baseRev, state}`，rev 不匹配返回 409 → 前端自动采用云端最新版；连续 3 次冲突停止并提示。
- **云端优先、最后写入者胜**：离线期间的本机改动在重新联网时会被云端版本覆盖（导入/重置有二次确认）。多设备同时在线编辑同一份数据仍有丢失风险，属已知取舍。

## 部署 / 更新流程

推荐从 git 取文件，避免手工拷贝造成漂移：

```bash
cd ~/workspace/shici-hub && git checkout main   # 或指定 tag
rsync -a --exclude '.git' --exclude '__pycache__' ./ /home/og/shici-memory/
systemctl --user restart shici
curl -s http://127.0.0.1:8765/api/health   # 注意：bind 在 tailnet IP，本机可用 tailscale ip -4 探测
```

发布正式版本时遵循 README「发布新版本」流程（版本号三处同步：`app-meta.js`、`package.json`、`CHANGELOG.md`）。

## 备份与恢复

- `state.json` 是唯一事实来源。建议定期拷贝到 NAS/网盘，或从网页「计划」页导出 JSON 留底（导出即完整 state 包装文件）。
- data-dir 下另有导出历史备份（如 `backups/拾词学习记录-*.json`）；这些是网页导出的原始副本，**不参与服务运行**。
- 恢复：停服 → 把备份的 `state.json` 放回 `--data-dir`（或直接通过网页导入 JSON，导入会覆盖云端共享数据并同步到所有设备）。
- 若 state.json 损坏，server.py 会自动将其隔离为 `state.json.corrupt-*` 并视为空库；下次任意设备保存即重建。被隔离的文件可用于人工排查。

## 安全边界（红线）

1. 不暴露公网 / Funnel。
2. 数据目录只放本机盘（网络文件系统上的原子 rename 不可靠）。
3. 未来若新增功能，**只有 state.json 参与同步**；按日期缓存的派生内容（如每日短文）应单独存放于 data-dir，不进 `state`，避免无谓 bump rev 与跨设备覆盖。
