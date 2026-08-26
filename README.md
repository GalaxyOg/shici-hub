# 拾词

一个零依赖的 IELTS / TOEFL / GRE / PTE Academic 间隔复习网页应用。项目将这套节奏称为 **BS 记忆法**（Build & Strengthen）：先建立记忆，再在第 2、3、7、30 天阶段强化。学习记录保存在浏览器 `localStorage` 中。

作者：[落日七号](https://github.com/luori7hao)（项目原作者） · 当前版本：`v1.1.0` · 发布仓库：[GalaxyOg/shici-hub](https://github.com/GalaxyOg/shici-hub) · 在线版：<https://galaxyog.github.io/shici-hub/>

> 本项目 fork 自 [luori7hao/shici-memory](https://github.com/luori7hao/shici-memory)。正式发布（GitHub Release、ZIP 更新包、Pages 在线版）均以本仓库 `GalaxyOg/shici-hub` 为准。

## 使用

- **在线版（推荐）**：直接访问 <https://galaxyog.github.io/shici-hub/>。推送 `main` 分支后 GitHub Pages 会自动重新部署，访问者刷新页面即为最新版。
- **本地版**：从 [GitHub Releases](https://github.com/GalaxyOg/shici-hub/releases) 下载 ZIP 解压后直接双击 `index.html`，或在此目录运行任意静态服务器，例如：

```powershell
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 下载与更新

正式版本统一保存在 [GitHub Releases](https://github.com/GalaxyOg/shici-hub/releases)。每个 Release 都包含可直接运行的 ZIP 包和 SHA-256 校验文件，Git 标签同时保留该版本的完整源码历史。

网页“说明”页底部提供“检查更新”按钮，它只会匿名读取 GitHub 最新正式 Release 的版本号，不会上传学习记录，也不会自动安装。发现新版本后：

- **本地版**会显示“一键下载新版 ZIP”，点击直接下载 Release 中的更新包；下载后解压覆盖旧文件即可（学习记录在浏览器里，不会因替换文件丢失）。浏览器出于安全限制无法自动覆盖本地文件，因此本地版没有全自动安装。
- **在线版**会显示“立即刷新用上新版”，因为 Pages 部署的站点始终是最新发布内容，刷新即完成更新。

离线、尚无 Release 或遇到 GitHub 匿名访问限流时，仍可直接打开历史版本页。

## 学习进度保存在哪里

应用没有账号系统，也没有服务器：全部学习记录（计划、进度、打卡、历史）保存在**当前浏览器的 `localStorage`** 中（键名 `shici-memory-v1`）。这意味着：

- 同一台设备、同一个浏览器、同一个地址再次打开时，进度自动还原，无需登录。
- `localStorage` 按“地址 + 浏览器 + 设备”隔离：本地 `index.html`、`localhost` 和在线版 `luori7hao.github.io` 互相是不同的存储空间，进度**不互通**；换浏览器或换电脑也不互通。
- 清除浏览器站点数据（或无痕模式关闭窗口）会清空进度。

因此“计划”页提供了**导出 / 导入学习记录**：导出会下载一份 JSON 备份文件，在新设备、新浏览器或在线版中导入即可完整迁移进度。建议定期导出留底。
因此“计划”页提供了**导出 / 导入学习记录**：导出会下载一份 JSON 备份文件，在新设备、新浏览器或在线版中导入即可完整迁移进度。建议定期导出留底。

## 云端同步后端（自部署）

本仓库的 `feat/cloud-sync` 分支提供可选的零依赖后端 `server.py`（仅 Python 标准库），把学习记录存为服务器上的单个 JSON 文档，多台设备共享同一份进度：

```bash
python3 server.py --data-dir /var/lib/shici-hub   # 默认绑定本机 Tailscale IP:8765
```

- **数据**：`--data-dir/state.json`（单文档、单调递增 `rev`、原子写入）。请使用本地磁盘，不要放在网络文件系统上。
- **静态文件根目录**：默认为 `server.py` 所在目录；可用环境变量 `SHICI_APP_ROOT` 指定。解析后逃逸出该目录的符号链接 / `..` 请求一律返回 403。
- **绑定地址**：默认取本机 Tailscale IPv4（仅 tailnet 内可达，流量经 WireGuard 加密）；取不到时回退 `127.0.0.1`。可用 `--bind` / `--port` 覆盖。**不要**把该端口暴露到公网或 Tailscale Funnel。
- **鉴权（变更类接口）**：设置环境变量 `SHICI_SHARED_SECRET=<随机串>` 后，`PUT` / `DELETE /api/state` 必须携带匹配的 `X-Shici-Secret` 请求头，否则返回 401；只读接口不受影响。未设置时变更操作保持可用以维持兼容，但启动日志会打印醒目的未鉴权告警——tailnet 内任何主机都可以覆盖或删除共享数据，介意请一定设置该变量。
- **冲突处理**：前端默认带 `baseRev` 乐观锁推送；发生 409 时采用云端较新文档（连续多次自动采用会停止并提示，避免两台设备互相覆盖）。导入 / 重置属于显式破坏性操作，经二次确认后才会无条件覆盖云端。
- **维护笔记**：部署、备份与安全边界等运维细节见 [`docs/self-hosting-deployment.md`](docs/self-hosting-deployment.md)。

## 已实现

- 今日新词和到期复习队列
- 每日任务单固定保存，关闭网页后仍保留原顺序和完成状态
- 每日新词量、目标考试词库设置
- 计划修改会立即重排未打卡的今日新词；已完成词、复习词和历史记录不受影响
- 可按 ECDICT 的 `zk` / `gk` 标签筛选或在后续计划中跳过中高考基础词
- 总进度、预计完成学习日和下一次复习提醒
- 完成任务后的手动打卡与月历记录
- 每日打卡单词快照、记录页和日历日期详情
- 支持推进到下一天、指定日期或恢复真实日期
- 音标、中英文释义、学科义项、词形、搭配、例句难词、同义词和对比记忆
- 使用浏览器 Web Speech API 的英文单词与例句朗读
- 模糊 / 记得 / 熟词三档反馈（已完全掌握的基本词可标「熟词」直接免复习，不再进入后续复习计划）
- 连续打卡天数、词库搜索和学习状态
- 词库每页 200 个，支持页码、前后页和指定页跳转
- 词库支持英文、音标、中英文释义搜索，按 `/` 可快速聚焦搜索框
- 词库词条使用独立右侧详情抽屉，不再进入今日学习队列
- 今日学习目录支持折叠并记住折叠状态
- 首次打开显示功能说明页，之后可从顶部“说明”随时查看
- 左侧任务按第 2、3、7、30 天复习和今日新词分组
- 调整学习日期时可选择保留顺延或跳过当前任务，并持续显示当前虚拟学习日
- 记录页内置日历、日期目录和困难词分析，可查看“第几遍”标记为模糊
- 说明页显示作者、当前版本，并可手动检查 GitHub Releases 更新
- **主动回忆模式**（计划页可开关）：学习卡片默认隐藏除单词和音标外的全部内容，先凭记忆回想；「偷看释义」临时展开并收起，偷看次数计入当日记录；反馈选项为模糊 / 记得 / 熟词三档

## 计划中的功能

- **每日英文短文**：根据当日学习 + 复习词自动生成一段简短英文段落（限制词汇难度），帮助在语境中理解新词；生成结果按日期缓存在服务器本地，不参与云端同步文档。

## 扩充词库

当前主词库的音标、双语释义、词性、词形和词频来自 MIT License 的开放双解词典 [ECDICT](https://github.com/skywind3000/ECDICT)。IELTS 5,040、TOEFL 6,974、GRE 7,504 个词按 ECDICT 标签提取；PTE Academic 使用固定版本的 Academic Word List 570 词头作为第三方备考学术核心，其中 537 个与前三类重叠，33 个是新增唯一词。生成后共有 12,880 个基础唯一词；项目另有 18 个手工精修词条，其中一个不在基础集合内，最终应用提供 12,881 个唯一词。

生成后的基础词库位于 `data/exam-vocab.js`，精修覆盖位于 `vocab.js`，PTE 输入与来源说明位于 `data/source/PTE/`，生成脚本是 `scripts/build_exam_vocab.py`。字段包括音标、中英文释义、规范化词性、考试分类和词形变化。第三方数据说明见 `THIRD_PARTY_NOTICES.md`。

IELTS、TOEFL 和 GRE 分类是 ECDICT 标签，不代表相应考试机构的官方收录或背书。本项目的 PTE 分类是基于 Academic Word List 整理的第三方学术英语学习范围，不是 Pearson 官方词表，也不代表 Pearson 推荐或背书。Academic Word List 最初由 Averil Coxhead 编制，原始研究见 Coxhead (2000), *A New Academic Word List*, TESOL Quarterly 34(2), 213–238；具体数据来源与许可边界见 `THIRD_PARTY_NOTICES.md`。

ECDICT 原始数据库还包含没有前三类考试标签、也不属于 PTE 学术核心的通用词、词形变化、短语、专有名词、地名、古旧词、技术术语以及按 BNC 等语料收录的词汇。本项目没有把这些约 75 万条内容直接加入背词计划，因为其中大量内容并不适合作为考试词表顺序学习。

ECDICT 没有为考试词条提供例句、同义词和搭配字段。应用对普通词条会把英文释义中的实词链接到词库作为“释义关键词联想”，并展示词形、常见前后缀和词频；这类链接不标作同义词。18 个精修词条仍保留人工例句、同义词、专业义项和搭配。

“释义关键词联想”的实现是：拆分英文释义、移除常见虚词，再把剩余英文实词与本地词头精确匹配。词缀提示由内置的常见前后缀表匹配生成；基础词等级来自 ECDICT 的 `zk` / `gk` 标签；Collins、Oxford、BNC 与现代语料排序直接读取 ECDICT 元数据。这些推导全部在浏览器本地完成。

每日顺序是：先取所有到期复习，按第 2/3/7/30 天阶段分组；同阶段内优先逾期更久、历史上标记“模糊”次数更多的词；最后从未学词中按精修词优先、语料词频由高到低加入当日新词。每日数量只限制新词，复习词额外加入。

## 发布新版本

维护者发布时同时修改 `app-meta.js` 与 `package.json` 中的语义化版本号，并更新 `CHANGELOG.md`，然后运行：

```powershell
npm test
git add .
git commit -m "release: v1.1.0"
git tag -a v1.1.0 -m "拾词 v1.1.0"
git push origin main
git push origin v1.1.0
```

`v*.*.*` 标签会触发 `.github/workflows/release.yml`：校验标签与应用版本、运行测试、打包运行文件、生成 SHA-256，并创建对应 GitHub Release。推送 `main` 分支会触发 `.github/workflows/pages.yml`，先运行测试再把运行文件部署到 GitHub Pages 在线版。应用版本与 `localStorage` 的 `shici-memory-v1` 存储键相互独立；普通发版不要修改存储键，以免影响已有学习记录。

## 作者与许可

项目作者为 **落日七号**（[@luori7hao](https://github.com/luori7hao)）。项目代码当前未另行授予开源许可证；ECDICT、AWL/PTE 数据和其他第三方内容继续遵循各自的许可与署名要求，详情见 `THIRD_PARTY_NOTICES.md`。
