# 更新记录

本项目采用语义化版本号。每个正式版本都会保留 Git 标签、GitHub Release、可直接运行的 ZIP 包和 SHA-256 校验文件。

## [Unreleased]

### 新增

- 可选的自托管云同步后端 `server.py`（仅 Python 标准库，零第三方依赖）：学习记录从浏览器 localStorage 迁移为服务器上的单个 JSON 文档（`--data-dir/state.json`），多台设备共享同一份进度。
  - 单调递增版本号 `rev` + 原子写入（临时文件 + rename）+ 进程内锁保证读改写安全；损坏文件自动隔离并允许新数据恢复。
  - 前端默认携带 `baseRev` 乐观锁推送，冲突（409）时自动采用云端较新版本；连续多次冲突会停止自动同步并提示人工处理，避免两台设备互相覆盖。
  - 默认绑定本机 Tailscale IPv4（仅 tailnet 内可达、WireGuard 加密），不可用时回退 `127.0.0.1`；切勿暴露到公网或 Tailscale Funnel。
  - 设置 `SHICI_SHARED_SECRET` 环境变量后，PUT/DELETE 接口要求匹配 `X-Shici-Secret` 请求头（401）；未设置时变更操作保持可用但启动日志打印醒目的未鉴权告警。
  - 前端自动探测后端：无后端或断网时透明降级为纯浏览器本地模式，每 15 秒重试重连；静态文件服务带路径穿越防护（符号链接与 `..` 逃逸一律 403）。

## [1.0.1] - 2026-08-01

### 新增

- GitHub Pages 在线版：推送 `main` 分支后自动部署到 <https://luori7hao.github.io/shici-memory/>，访问者刷新即为最新版。
- 一键更新入口：本地版检测到新版本时可直接下载 Release 中的 ZIP 更新包；在线版则显示"立即刷新用上新版"按钮。
- 学习记录导出 / 导入：在"计划"页可将 localStorage 中的全部进度导出为 JSON 备份，并在其他设备、浏览器或在线版中导入迁移。
- 说明页与计划页补充学习记录的保存位置说明（浏览器本地 localStorage，不上传服务器）。

## [1.0.0] - 2026-07-15

### 新增

- IELTS、TOEFL、GRE 与 PTE Academic 四类词库，共 12,881 个唯一词条。
- BS 记忆法：初学后在第 2、3、7、30 天阶段复习。
- 每日任务、困难词循环强化、完成后打卡和历史日历。
- 词库搜索、筛选、分页、词条详情、音频朗读和学习难度记录。
- 当天计划调整、学习日期顺延或跳过，以及旧学习记录兼容。
- GitHub Releases 手动更新检测，不上传浏览器内的学习记录。

[1.0.1]: https://github.com/luori7hao/shici-memory/releases/tag/v1.0.1
[1.0.0]: https://github.com/luori7hao/shici-memory/releases/tag/v1.0.0
