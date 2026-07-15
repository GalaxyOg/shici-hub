# 拾词

一个零依赖的 IELTS / TOEFL / GRE / PTE Academic 间隔复习网页应用。项目将这套节奏称为 **BS 记忆法**（Build & Strengthen）：先建立记忆，再在第 2、3、7、30 天阶段强化。学习记录保存在浏览器 `localStorage` 中。

作者：[落日七号](https://github.com/luori7hao) · 当前版本：`v1.0.0` · 仓库：[luori7hao/shici-memory](https://github.com/luori7hao/shici-memory)

## 使用

直接双击 `index.html`，或在此目录运行任意静态服务器，例如：

```powershell
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 下载与更新

正式版本统一保存在 [GitHub Releases](https://github.com/luori7hao/shici-memory/releases)。每个 Release 都包含可直接运行的 ZIP 包和 SHA-256 校验文件，Git 标签同时保留该版本的完整源码历史。

网页“说明”页底部提供“检查更新”按钮，它只会匿名读取 GitHub 最新正式 Release 的版本号，不会上传学习记录，也不会自动安装。发现新版后可跳转到 GitHub 查看更新说明并下载；离线、尚无 Release 或遇到 GitHub 匿名访问限流时，仍可直接打开历史版本页。

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
- 模糊 / 费力 / 记得三档反馈
- 连续打卡天数、词库搜索和学习状态
- 词库每页 200 个，支持页码、前后页和指定页跳转
- 词库支持英文、音标、中英文释义搜索，按 `/` 可快速聚焦搜索框
- 词库词条使用独立右侧详情抽屉，不再进入今日学习队列
- 今日学习目录支持折叠并记住折叠状态
- 首次打开显示功能说明页，之后可从顶部“说明”随时查看
- 左侧任务按第 2、3、7、30 天复习和今日新词分组
- 调整学习日期时可选择保留顺延或跳过当前任务，并持续显示当前虚拟学习日
- 记录页内置日历、日期目录和困难词分析，可查看“第几遍”标记为费力
- 说明页显示作者、当前版本，并可手动检查 GitHub Releases 更新

## 扩充词库

当前主词库的音标、双语释义、词性、词形和词频来自 MIT License 的开放双解词典 [ECDICT](https://github.com/skywind3000/ECDICT)。IELTS 5,040、TOEFL 6,974、GRE 7,504 个词按 ECDICT 标签提取；PTE Academic 使用固定版本的 Academic Word List 570 词头作为第三方备考学术核心，其中 537 个与前三类重叠，33 个是新增唯一词。生成后共有 12,880 个基础唯一词；项目另有 18 个手工精修词条，其中一个不在基础集合内，最终应用提供 12,881 个唯一词。

生成后的基础词库位于 `data/exam-vocab.js`，精修覆盖位于 `vocab.js`，PTE 输入与来源说明位于 `data/source/PTE/`，生成脚本是 `scripts/build_exam_vocab.py`。字段包括音标、中英文释义、规范化词性、考试分类和词形变化。第三方数据说明见 `THIRD_PARTY_NOTICES.md`。

IELTS、TOEFL 和 GRE 分类是 ECDICT 标签，不代表相应考试机构的官方收录或背书。本项目的 PTE 分类是基于 Academic Word List 整理的第三方学术英语学习范围，不是 Pearson 官方词表，也不代表 Pearson 推荐或背书。Academic Word List 最初由 Averil Coxhead 编制，原始研究见 Coxhead (2000), *A New Academic Word List*, TESOL Quarterly 34(2), 213–238；具体数据来源与许可边界见 `THIRD_PARTY_NOTICES.md`。

ECDICT 原始数据库还包含没有前三类考试标签、也不属于 PTE 学术核心的通用词、词形变化、短语、专有名词、地名、古旧词、技术术语以及按 BNC 等语料收录的词汇。本项目没有把这些约 75 万条内容直接加入背词计划，因为其中大量内容并不适合作为考试词表顺序学习。

ECDICT 没有为考试词条提供例句、同义词和搭配字段。应用对普通词条会把英文释义中的实词链接到词库作为“释义关键词联想”，并展示词形、常见前后缀和词频；这类链接不标作同义词。18 个精修词条仍保留人工例句、同义词、专业义项和搭配。

“释义关键词联想”的实现是：拆分英文释义、移除常见虚词，再把剩余英文实词与本地词头精确匹配。词缀提示由内置的常见前后缀表匹配生成；基础词等级来自 ECDICT 的 `zk` / `gk` 标签；Collins、Oxford、BNC 与现代语料排序直接读取 ECDICT 元数据。这些推导全部在浏览器本地完成。

每日顺序是：先取所有到期复习，按第 2/3/7/30 天阶段分组；同阶段内优先逾期更久、历史上标记“费力”次数更多的词；最后从未学词中按精修词优先、语料词频由高到低加入当日新词。每日数量只限制新词，复习词额外加入。

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

`v*.*.*` 标签会触发 `.github/workflows/release.yml`：校验标签与应用版本、运行测试、打包运行文件、生成 SHA-256，并创建对应 GitHub Release。应用版本与 `localStorage` 的 `shici-memory-v1` 存储键相互独立；普通发版不要修改存储键，以免影响已有学习记录。

## 作者与许可

项目作者为 **落日七号**（[@luori7hao](https://github.com/luori7hao)）。项目代码当前未另行授予开源许可证；ECDICT、AWL/PTE 数据和其他第三方内容继续遵循各自的许可与署名要求，详情见 `THIRD_PARTY_NOTICES.md`。
