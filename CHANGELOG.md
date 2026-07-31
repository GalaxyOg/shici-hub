# 更新记录

本项目采用语义化版本号。每个正式版本都会保留 Git 标签、GitHub Release、可直接运行的 ZIP 包和 SHA-256 校验文件。

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
