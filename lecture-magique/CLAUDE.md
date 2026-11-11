# Lecture Magique — 给 Claude Code 的实现说明

家用法语阅读网站，给 11 岁的 Grace（以后可能多几个孩子账号）用：读文章、点词查 Petit Robert、后台记录每个词的熟悉度、每周复习小测。

**完整设计在 `docs/DESIGN.md`，开工前先通读一遍。** 本文件只补充工程约定和第一期的具体范围。两者冲突时以本文件为准。

## 已定的决定

- 后端：Python 3.12 + FastAPI。包管理用 `uv`。
- 数据库：现有 Postgres 的 `postgres` 库（记账数据在其中的 `family_budget` schema），新建 schema `lecture`。应用用专用角色 `lecture_app` 连接，**不得访问其他 schema**（尤其是 `family_budget`）。
- 前端：React + Vite + TypeScript，构建产物由 FastAPI 作为静态文件提供（单进程）。
- 设备：iPad（Safari）+ 学校发的 Chromebook（Chrome）。只在家里内网用，**http，不做 PWA / service worker**（service worker 只能在 HTTPS 下注册）。
- 词典：法语释义用 Petit Robert 2007（`tools/ld2.py` + `tools/robert_extract.py` 已能解析，85,062 条）。英文释义用 Wiktionary（wiktextract 数据，第二期接入）。
- 部署：Mac Studio，launchd 开机自启，监听内网端口（默认 8090）。

## 版权与数据（硬性规则）

- Petit Robert 是商业词典。`.ld2` 文件、`robert.jsonl` 以及任何从它导出的数据**都不能提交到 git**，也不能放进测试 fixture。词典路径用环境变量 `ROBERT_LD2_PATH` 传入。
- 测试只用自己写的几个假词条，或公有领域文本。
- 孩子账号只存显示名和学习记录，不存年龄、学校、邮箱。

## 仓库结构（建议）

```
lecture-magique/
  CLAUDE.md
  docs/DESIGN.md            # 从 Claude Docs 导出的设计文档
  tools/ld2.py              # Lingoes .ld2 解析（已验证）
  tools/robert_extract.py   # 拆词义 → JSONL（已验证）
  backend/
    pyproject.toml
    app/                    # FastAPI：main.py, db.py, auth.py, routers/, models/
    importer/               # 词典导入、文章导入（分词、spaCy、匹配词条）
    migrations/             # Alembic
    tests/
  frontend/                 # React + Vite + TS
  deploy/                   # launchd plist、示例 .env
```

## 配置（`.env`，不提交）

```
DATABASE_URL=postgresql+psycopg://lecture_app:***@localhost:5432/postgres
DATABASE_ADMIN_URL=...      # 只给迁移和 schema 初始化用
ROBERT_LD2_PATH=/path/to/Le_Nouveau_Petit_Robert_de_la_langue_francaise_2007.ld2
SESSION_SECRET=...
PORT=8090
```

所有 SQL 都显式加 `lecture.` 前缀，或者在连接上设置 `search_path=lecture`。不要依赖默认的 `public`。

## 第一期范围：能读、能点、能记

只做这些，**不接大模型、不做 FSRS 调度、不做周测**（这些是第二期）。

1. **Schema**：按 `docs/DESIGN.md` 的 DDL 写 Alembic 迁移。第一期要用到的表：`app_user`、`lemma`、`word_form`、`sense`、`article`、`chapter`、`paragraph`、`token`、`reading_progress`、`lookup_event`、`user_word`。其余表可以先建出来，但不用写逻辑。另写一个 `deploy/init_role.sql`，由 Ryan 用管理员账号手动执行，用来创建 `lecture_app` 角色和授权。
2. **词典导入**（`importer/robert.py`）：读 `.ld2` → 用 `robert_extract.parse` → 写入 `lemma` 和 `sense`（`source='petit_robert'`，`sense_key` 例如 `I.2`，每个义项最多 6 个例句）。
   - 词头规范化：`"tubéreux, euse"` → 原型 `tubéreux`，阴性形式进 `word_form`；`"2. livre"` → 同形异义词编号 2。
   - 跳过 `kind=author` 的条目。
   - 把 Robert 的词性（"verbe transitif"、"nom féminin"……）映射到 spaCy 的 UPOS（VERB、NOUN……）；名词的阴/阳性存进 `gender`。
   - 必须可以重复执行：已有就更新，不会插出重复行。
3. **文章导入**（`importer/article.py`，CLI）：读一个"文章包" JSON（格式见设计文档"内容管线"一节）→ 分词 → spaCy `fr_core_news_sm` 还原原型 → 匹配 `lemma`（找不到再查 `word_form`，还找不到就标 `needs_review`）→ 写入 `token`，`sense_id` 暂时取该原型的第一个义项 → 状态设为 `draft`。另提供一个 `publish` 子命令。
   - 分词时要处理法语省音（l'、qu'、j'、d'、n'，包括弯撇号 ’）、连字符词（peut-être、porte-coton）、数字和标点（`is_word=false`）。
   - 每个 token 都要记 `char_start` / `char_end`，前端拼回原文要和原文逐字一致。
4. **认证**：用户名 + 密码（argon2id），HttpOnly + SameSite=Lax 的会话 cookie，30 天有效。连续失败 5 次锁定 5 分钟。用 CLI 创建用户：`python -m app.cli create-user grace --role student`。
5. **API**（第一期用到的）：`/auth/login`、`/auth/logout`、`/me`、`GET /articles`、`GET /articles/{id}/chapters/{seq}`（一次返回段落 + token + 这一章用到的词条和义项 + 当前用户对这些词的熟悉度）、`PUT /progress/{articleId}`、`POST /chapters/{id}/complete`、`POST /lookups`（支持批量）。学生接口的 user_id 一律从会话里取。
6. **点词记录逻辑**：
   - 每次点击写一条 `lookup_event`，包括 `self_rating`（unknown / vague / known，默认 unknown）和 `dwell_ms`。
   - 同时 upsert `user_word`：`lookup_count += 1`。第一次点就创建（`familiarity=0`）；如果第一次就选了 known，`status='known'`。
   - 读完一章时，本章里**没点**、但在 `user_word` 里的词，`exposure_count += 1`。
   - FSRS 字段留空，第二期用 `lookup_event` 回放生成初始状态。所以事件日志必须完整，绝不能丢。
7. **前端**：登录、书架、阅读器、点词卡片、夜间模式。
   - 卡片：原词、原型和词性、IPA、Robert 选中的那个义项（编号 + 释义 + 2–3 个例句）、朗读按钮（Web Speech API，优先 fr-CA 声音）、三个按钮"不认识 / 有点印象 / 其实我认识"。点卡片外面任意地方关闭。
   - 打开章节时预加载全部词条，卡片弹出不能等网络。点词事件先进内存队列，后台批量发送，失败就重试。
   - 只用点击 / 轻触，不依赖鼠标悬停。Chromebook 上支持快捷键：Esc 关卡片、空格朗读、左右键翻章。
   - 排版：正文至少 20px，行距 1.7，每行约 65 个字符以内；晚上 7 点后自动切到夜间模式，也可以手动切换。
   - 每个 token 渲染成 `<span data-t="{token_id}">`，点击事件委托到段落容器上。
8. **部署**：`deploy/com.lecture-magique.plist`（launchd）+ 一个构建并重启的脚本。

### 第一期验收标准

- [ ] 词典导入完成后，`entamer` 在 `sense` 表里有 6 行，其中 `sense_key='I.2'` 的释义以 "Couper en enlevant une partie" 开头。
- [ ] 用一篇公有领域的测试文章（比如 Jules Verne 作品的一段）导入后，`is_word=true` 的 token 中 ≥ 95% 能匹配到 `lemma`；没匹配上的列在导入报告里。
- [ ] iPad Safari 和 Chromebook Chrome 上都能：登录 → 打开文章 → 点词 → 卡片 100ms 内出现 → 刷新页面后 `lookup_event` 里有记录。
- [ ] 学生 A 不能读到学生 B 的进度和词表（写测试覆盖）。
- [ ] `pytest` 全部通过；测试连的是独立的测试 schema 或 Docker 里的 Postgres，**不能连正式库（含 `family_budget` schema 的那个库）**。

## 工作方式

- 每完成上面一个编号步骤就 commit 一次，commit 信息用英文。
- 碰到设计文档没说清楚、而且会影响数据模型的地方，先停下来问 Ryan；纯实现细节自己决定，在 PR / commit 里写明。
- 第二期（FSRS、周测、Wiktionary 英文释义、本地模型选词义）和第三期（开放题、写作批改）的细节都在 `docs/DESIGN.md` 里。第一期**不要**提前实现，但数据模型不能堵死它们。
