# Lecture Magique — 法语阅读与写作网站设计文档

2026-11-10 · Ryan Sun

## 背景与价值

结论：值得做，但要分两期——第一期两到三个周末只做“读文章 + 点词 + 记录”，先验证 Grace 愿意用；复习测验和写作批改放第二期。

**问题（Problem）**

- 老师要求提前面谈，说明法语阅读/写作在学校里已经被注意到。
- 已知弱点：开放式问题。9 月 30 日的课堂阅读测验里，Mme Leidei 指出她的答案没有紧扣题目——一题答得太窄（“entamé” 理解偏了），一题答得太宽。
- 她不愿意自己捧书读，所以“多读书”这条路走不通，需要一个她愿意打开的入口。
- 目前没有任何数据告诉我们：她到底卡在哪些词上、读了多少、忘了多少。

**价值（Value）**

- 受益人：Grace（主要），以及你——第一次能看到她的阅读数据。
- 证据一：词汇量与阅读理解高度相关。二语研究常把“认识文中 95%–98% 的词”作为能读懂的范围（[Schmitt, Cobb 等 2015](https://www.lextutor.ca/cover/papers/schmitt_cobb_etal_2015.pdf)），但也发现两者是一条渐进曲线，没有突然跨过的门槛（[Schmitt, Jiang & Grabe 2011](https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf)）。注意：这些研究对象多是成人二语学习者，用在一个在法语学校上学的 11 岁孩子身上只能当方向参考。
- 证据二：“测一测”比“再读一遍”记得更牢，这叫检索练习（testing effect），在中小学课堂里也反复被验证（[Roediger & Karpicke 回顾，2018](https://moodle2.units.it/pluginfile.php/572734/mod_resource/content/1/testing.pdf)）。这正是每周词汇小测的依据。
- 证据三：“点词查义 + 给词打熟悉度 + 间隔复习”这一套已经被商业产品验证过，例如 LingQ 的 1–4 级词状态（[LingQ 帮助文档](https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status)）。我们是给一个孩子做定制版，不是发明新方法。
- 量化：目前**未量化**。衡量指标：每周阅读分钟数、每篇文章查词数、周测正确率（按词的“记住率”）、开放题评分（是否紧扣题目），以及下一次老师反馈。

**成本（Cost）**

- 开发：一个后端服务 + 一个前端页面 + 一次性词典导入。我的估计：第一期约 15–25 小时（估计，不是测量）。
- 运行：家里现有的 Postgres 新建一个 schema；服务可跑在 Mac Studio 上，额外运行成本接近零。
- 新增要维护的东西：一个 Web 服务、一个登录系统、一份词典数据、每周导入一篇文章的脚本。
- 机会成本：每周准备文章和问题的时间（预计每周 30–60 分钟，估计），以及你晚上本可以做别的项目的时间。

**需要你做的决定（Ask）**——11 月 10 日已定：后端用 Python（FastAPI）；法语释义用你的 Petit Robert，英文用 Wiktionary；只在家里内网用，设备是 iPad 和 Chromebook。剩下的见文末“待定问题”。

**最强的反对意见**：老师面谈就在眼前，而一个带登录和数据库的平台需要几周才成型；在这期间，最有效的可能是你陪她每天读 15 分钟纸质书 + 用现有工具查词。我的回应：两者不冲突——第一期刻意做小，先上线“能读、能点、能记”，面谈前就可以用。

**何时重新评估**：上线 4 周后，如果她每周主动使用少于 3 次，或者周测记住率没有上升（比如连续 3 周低于 60%），就停止加功能，回头检查内容是不是太难或不够有趣。

## 总体架构

三个运行时组件（浏览器、API 服务、Postgres）加一个每周跑一次的导入脚本，全部在家里的 Mac Studio 上。

> （架构图：导出时省略，见“总体架构”文字描述）

上排是 Grace 每天用到的部分，浏览器和 API、API 和数据库之间都是请求/响应；下排是你每周一次的内容准备。分词、词义选择、大模型调用都在下排完成，所以阅读时不依赖任何在线服务。

## 前台：阅读界面

核心原则：阅读页上只有文章，其他一切都是“点了才出现、轻触就消失”。所有记录都在后台静默发生，她不需要做任何“保存”动作。

**页面结构（共 5 个页面）**

| 页面 | 她在这里做什么 | 关键设计 |
|---|---|---|
| 登录 | 用户名 + 密码 | 记住登录 30 天，平板上不用每次输 |
| 我的书架 | 选本周文章 | 每篇文章一张封面卡，显示进度环和“上次读到哪”；本周新文章顶置 |
| 阅读器 | 读、点词 | 见下方“阅读器细节” |
| 我的词袋 | 看自己“收集”的词 | 每个词一张小卡片，颜色 = 熟悉度；按“新收 / 快忘了 / 已掌握”分组 |
| 周挑战 | 每周复习小测 | 10–15 分钟一轮，结束有结算画面 |

家长端另有一个管理页（只有你能看到）：上传文章、看她的查词记录、批改写作。

**阅读器细节**

- 排版：大字号（至少 20px）、行距 1.7、每行不超过约 65 个字符；长文章切成“章”，每章 5–10 分钟读完，一章一页，底部是下一章按钮。
- 点词：轻点一个词 → 词下方弹出一张小卡片（手机/窄屏时从底部升起），只盖住下方一两行；点卡片外任意位置关闭。不跳页、不开新窗口。
- 卡片内容（从上到下）：原词 → 原型和词性（“venait → venir, v.”）→ 这句话里的意思（英文，一行）→ 法语释义（一行，孩子能懂的版本）→ 一个小喇叭（朗读这个词）→ 三个小按钮“不认识 / 有点印象 / 其实我认识”。不点按钮也行，默认按“不认识”记录。
- 不打断阅读：记录请求在后台异步发送（先放浏览器队列，失败自动重试）；本章所有词的词条在打开章节时一次性预加载，所以卡片是瞬时弹出，不等网络。
- 查过的词：在后面的文章里再出现时，下方加一条淡淡的虚线（可关闭）——让她发现“哦，这个我见过”，这本身就是一次复习。
- 整句帮助：长按（或双击）句子 → 给出整句的英文大意。这个功能要限量（比如每章 3 次），否则她会只看英文。
- 夜间模式：深色背景 + 暖色文字，默认晚上 7 点后自动切换。
- 朗读：用浏览器自带的语音合成（优先选加拿大法语 fr-CA 声音），可以朗读单词或整段。

**让她愿意打开（趣味设计）**

- “抓词”的收集感：每查一个词，词袋里多一张卡；一个词从“新收”变成“已掌握”时卡片翻成金色。这是把“不认识的词”从尴尬变成战利品。
- 进度可见：书架上的进度环、连续阅读天数（中断一天不清零，只是暂停，避免泄气）。
- 每章末尾一个小问题：不是测验口吻，而是“你觉得他为什么这样做？”——正好练开放式问题。
- 不用积分排行榜：只有她一个人用时排行榜没意义；以后多个孩子用也不建议互相比。
- 视觉风格沿用数学练习页：圆角卡片、明亮但不刺眼的配色、小动画只用在“完成”时刻，阅读时零动画。

**设备与前端技术**：她用 iPad（Safari）和学校发的 Chromebook（Chrome），都在家里网络上用，和数学练习页一样。

- 单页应用（React + Vite），同一套界面同时适配触屏和触控板：点词一律是点击/轻触，不依赖鼠标悬停（iPad 没有悬停）。
- Chromebook 上加键盘快捷键：Esc 关卡片、空格朗读、左右键翻章。
- 不做 PWA 离线缓存：离线缓存靠 service worker，而浏览器只允许在 HTTPS 等“安全上下文”里注册它（[MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_contexts)），家里内网用 http 访问时用不了。iPad 上“添加到主屏幕”当书签，Chromebook 上收藏到书签栏。点词事件仍先放内存队列，Wi-Fi 断一下会自动重试。
- 学校的 Chromebook 可能有学校设的限制；数学页能用说明访问家里内网地址没问题，但每次上线新功能都在两台设备上各试一遍。
- 朗读用浏览器自带的语音合成，两台设备上可用的法语声音不同，上线前各试一次。
- 每个词是一个带 token id 的 `<span>`，点击事件统一委托到段落容器上，性能不受文章长度影响。

## 点词查词流程

关键决定：**所有“重活”都在每周导入文章时做完**（分词、还原原型、挑选词义、生成英文释义），她点词时后台只做一件事：写一条记录。这样点击永远是瞬时的，也不依赖任何在线翻译服务。

**导入时（每周一次，离线）**

1. 分词：把文章切成 token，处理法语的省音（l’, qu’, j’）和连字符词（peut-être）。
2. 还原原型：用 spaCy 的法语模型，它自带词性标注和原型还原组件（[fr_core_news_sm](https://huggingface.co/spacy/fr_core_news_sm)）。→ *venaient* 变成 *venir*，*belles* 变成 *beau*。熟悉度记在原型上，不记在变位形式上。
3. 匹配词条：用原型 + 词性到词典表里找词条。
4. 选词义：一个词常有多个意思。把“句子 + 候选词义列表”交给大模型，让它选出这句话里的那个，并写一句孩子能懂的法语解释。可以用你 Mac Studio 上的本地模型（免费、离线），或者每周导入时由 Claude 顺手做。
5. 人工抽查：管理页列出“模型不确定”的词，你或 Claude 修正后再发布。
6. 发布：写入数据库，文章在她的书架上出现。

**阅读时（每次点词）**

1. 打开一章时，前端一次拿到本章所有 token + 对应词条 + 她对这些词当前的熟悉度。
2. 她点一个词 → 前端从内存里取词条，立刻弹卡片。
3. 同时后台发送一个事件：谁、哪个 token、哪个原型、时间、卡片停留了多久、她点了哪个按钮。
4. 后台在同一个事务里：插入一条查词记录；更新这个词的熟悉度（见“熟悉度模型”）。
5. 她读完一章时，前端发送“本章完成”，后台把本章中她**没有点**的、且在词袋里的词记一次“见到了但没查”（弱的正向信号）。

注：大模型只用在离线导入里，结果存库。她用的时候不会发生任何实时生成，所以也不存在“孩子和 AI 聊天”的入口。

## 词典方案

已定：法语释义用你的《Le Nouveau Petit Robert 2007》（法语助手的 .ld2 文件），英文翻译用英文版 Wiktionary 的法语词条。Petit Robert 是法法词典，没有英文，所以两个来源都要。

**解析验证（2026-11-10）**：.ld2 是 Lingoes 格式，已用一个约 60 行的 Python 脚本完整解出。

| 项 | 结果 |
|---|---|
| 文件大小 / 解压后 | 41 MB / 287 MB（HTML 格式词条） |
| 条目总数 | 85,062（其中 1,109 条是引文作者介绍） |
| 普通词条 / 解出词义的 | 83,953 / 78,298 |
| 解出的词义数 | 165,134（带编号如 I.2，每个含释义 + 最多 6 个例句） |
| 全量处理时间 / 输出 | 约 3.6 秒 / 35 MB JSONL |

示例——*entamer* 解出 6 个词义。其中 I.2 是“Couper en enlevant une partie à (qqch. dont on n'a encore rien pris)”，例句“Pain entamé.”。这正是 9 月 30 日测验里 Grace 答偏的那个意思：她理解成了 I.1（切开皮肤）。导入时让模型按句子选出 I.2，卡片就能直接给出对的意思。

**卡片上怎么用**

- 第一行：孩子版法语解释 + 英文意思（导入时生成）。
- 展开“Petit Robert”：只显示选中的那个词义（编号 + 释义 + 2–3 个例句），不显示整条——*venir* 的完整词条有 8 万多字符，孩子看不下去。
- 英文释义从 Wiktionary 取，只作为模型写英文一行时的参考和备用。

**已知的小问题（写正式导入脚本时处理）**

- 少数罕见词没收录（如 *fouetteur*）→ 退回 Wiktionary。
- 形容词词头写成 “tubéreux, euse” 这种格式，需要拆出原型再建索引。
- 有些子词义没有编号（如 *mouche* 的部分条目），暂时并入上一个词义。
- 约 5,600 个普通条目解不出词义，抽样看大多是人名和不带重音的变体写法。

**版权**：Petit Robert 是 Le Robert 出版社的商业词典。它的内容只放在家里内网、登录后可见，不对外公开，也不要把导出的词典数据分享给别人。Wiktionary 部分没有这个限制。

Wiktionary 依据：wiktextract 把 Wiktionary 抽取成 JSON；英文版释义是英文，但收录上百种语言的词（[wiktextract README](https://www.github.com/tatuylonen/wiktextract)）；预抽取数据以 JSON Lines 提供（[PyPI](https://pypi.org/project/wiktextract)）。同时导入它的变位表，作为 spaCy 还原不出原型时的后备。

## 熟悉度模型

建议用两层：底层用开源的 FSRS 间隔重复算法管“什么时候该复习”，上层给孩子看一个 0–5 的“熟悉度”，由底层数据算出来。

**为什么选 FSRS**

- 它是开源算法，有学术论文支撑，并已有 Python、Rust、Go、JS 等多语言实现（[Open Spaced Repetition](https://github.com/open-spaced-repetition)）。Python 版 py-fsrs 是 MIT 协议（[py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)）。
- Anki 23.10 起已把 FSRS 作为可选调度器（[fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs)）。
- 它用“难度、稳定性、可提取概率”三个量描述记忆，比老的 SM-2 更准（[一个 TS 实现的说明](https://github.com/SqueakyRobot/fsrs)）。
- 对我们最重要的是：它给每个词一个“下次到期日”，周测选词直接用这个日期排序即可。
- Java 后端也能用：算法公式不长，可以照着官方说明移植到 Java；或者后端用 Python 直接引用 py-fsrs。

**信号 → 评分的映射**

FSRS 接受 4 种评分：Again（忘了）、Hard、Good、Easy。我们把她的行为映射过去：

| 她的行为 | 记作 | 说明 |
|---|---|---|
| 第一次点某个词 | 新建词卡，评 Again | 这个词进入她的词袋 |
| 点了，并选“其实我认识” | 评 Good（第一次则标为“已知”，不进复习） | 可能是手滑，也可能只是确认一下 |
| 点了，选“有点印象” | 评 Hard |  |
| 几天后又点了同一个词 | 评 Again（算一次“遗忘”） | 这是最有价值的信号 |
| 同一章里又点一次 | 只记查词日志，不重复评分 | 避免同一天反复扣分 |
| 在词袋里，读到了但没点 | 只加“见到次数”，不喂给 FSRS | 可能认识，也可能跳过了，信号太弱 |
| 周测答对且快 | Good 或 Easy | 按反应时间区分 |
| 周测答对但很慢 | Hard |  |
| 周测答错 | Again | 卡片立刻给出正确答案 + 原句 |

**给孩子看的熟悉度（0–5）**

- 0 新收：刚查过，还没复习。
- 1–2 在学：复习过但记忆稳定性低于约 1 周。
- 3–4 熟悉：稳定性 1 周到 1 个月。
- 5 已掌握：稳定性超过约 1 个月，卡片变金色。
- 阈值是初始设置，不是研究结论；跑一个月后按她的实际数据调。

这个分级和 LingQ 的 1–4 级 + “已知”的思路一致（[LingQ](https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status)），区别是我们不让她自己手动调级，而是由行为和周测自动算。所有评分存成复习日志，将来数据够了可以用 FSRS 的优化器为她单独拟合参数。

## 每周复习与测验

每周一自动生成一份“周挑战”：15–20 个词、10–15 分钟。题目优先用她读过的原句，让复习和文章记忆绑在一起。

**选词规则（按顺序填满为止）**

1. 已到期的词：FSRS 的下次到期日 ≤ 今天，按“遗忘次数多”优先。
2. 从未复习过的词：查过但还没进过任何一次测验，按查询次数多优先。
3. 本周新文章里的高频生词：由你在管理页勾选“重点词”，她没查也放进来。
4. 每次测验不超过 5 个全新词，避免太难让她丧气。

**题型（从易到难）**

| 题型 | 形式 | 练什么 |
|---|---|---|
| 认义 | 看法语词，从 4 个英文意思里选 | 认识 |
| 原句填空 | 她读过的句子挖空，从 4 个词里选 | 语境理解 |
| 法法配对 | 把 5 个词拖到 5 个法语释义上 | 用法语理解法语 |
| 听写 | 播放读音，她拼出来 | 拼写（含重音符号） |
| 造句 | 用这个词写一句话 | 主动使用，连接写作 |

前四种自动判分。造句由你或 Claude 周末批改后再回写评分。一个词熟悉度越高，给它的题型越往下走。

**结果回写**

- 每答一题即时写入：答案、对错、反应时间 → 映射成 FSRS 评分 → 更新该词状态 + 写一条复习日志。
- 中途退出不丢进度，下次从未答的题继续。
- 答错的词在本轮末尾再出现一次（换一种题型），第二次的结果只记日志，不再更改 FSRS 状态。
- 结束页：本周变金色的词、还要加油的词；家长端同时生成一份英文周报。

为什么用测验而不是“再看一遍词表”：研究发现，一周后的记忆中，多做检索练习的组好于多重读的组（[Roediger & Karpicke](https://moodle2.units.it/pluginfile.php/572734/mod_resource/content/1/testing.pdf)）。

## 数据库设计

在 family_budget 库里新建 schema `lecture`，并新建一个只能访问这个 schema 的数据库角色给网站用——网站即使被攻破，也碰不到记账数据。数据分三块：内容（所有用户共享）、词典（共享）、用户状态（每人一份）。

| 表 | 分类 | 一行代表 | 估计规模 |
|---|---|---|---|
| `app_user` | 用户 | 一个账号（学生/家长） | 个位数 |
| `article` / `chapter` / `paragraph` | 内容 | 一篇文章 / 一章 / 一段 | 每周 1 篇 |
| `token` | 内容 | 文章里的一个词（含位置和对应原型、词义） | 每篇几千行 |
| `lemma` | 词典 | 一个原型 + 词性，如 venir/VERB | 导入后数十万行 |
| `word_form` | 词典 | 一个变位形式 → 原型 | 百万级，只在导入时用 |
| `sense` | 词典 | 一个词义（英文释义、法语释义、来源） | 数十万行 |
| `token_gloss` | 内容 | 导入时为某个词生成的孩子版解释 | 每篇几百行 |
| `question` | 内容 | 一道阅读理解题或写作题 | 每周 5–10 题 |
| `reading_progress` | 用户 | 某人读某篇读到哪 | 人 × 篇 |
| `lookup_event` | 用户 | 一次点词（只追加，永不修改） | 每周几百行 |
| `user_word` | 用户 | 某人对某个原型的当前熟悉度 + FSRS 状态 | 人 × 词 |
| `review_log` | 用户 | 一次 FSRS 评分 | 每周几十到几百行 |
| `quiz` / `quiz_item` | 用户 | 一次周测 / 其中一题 | 每周 1 次 |
| `answer` | 用户 | 她对一道阅读题或写作题的回答 + 批改 | 每周几条 |

设计要点：“发生了什么”（`lookup_event`、`review_log`）和“现在是什么状态”（`user_word`）分开存。状态表随时可以从日志重算，将来换算法或调阈值不丢数据。

```sql
CREATE SCHEMA lecture;
SET search_path TO lecture;

-- 用户
CREATE TABLE app_user (
  id            bigserial PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  password_hash text NOT NULL,              -- argon2id / bcrypt
  role          text NOT NULL CHECK (role IN ('student','parent','admin')),
  settings      jsonb NOT NULL DEFAULT '{}', -- 字号、夜间模式等
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 词典（共享）
CREATE TABLE lemma (
  id        bigserial PRIMARY KEY,
  lemma     text NOT NULL,
  pos       text NOT NULL,          -- NOUN / VERB / ADJ ...
  gender    text,                   -- m / f
  ipa       text,
  freq_rank int,                    -- 词频排名，用于挑重点词
  UNIQUE (lemma, pos)
);
CREATE TABLE word_form (
  form     text NOT NULL,
  lemma_id bigint NOT NULL REFERENCES lemma(id),
  tags     text[],                   -- plural, imperfect, 3rd-person ...
  PRIMARY KEY (form, lemma_id)
);
CREATE TABLE sense (
  id            bigserial PRIMARY KEY,
  lemma_id      bigint NOT NULL REFERENCES lemma(id),
  source        text NOT NULL,       -- petit_robert / wiktionary_en
  sense_key     text,                -- 来源里的 sense id
  gloss_en      text,
  definition_fr text,
  example_fr    text,
  raw           jsonb                -- 原始词条备用
);
CREATE INDEX ON sense (lemma_id);

-- 内容（共享）
CREATE TABLE article (
  id          bigserial PRIMARY KEY,
  slug        text UNIQUE NOT NULL,
  title       text NOT NULL,
  week_of     date NOT NULL,
  level       text,                  -- 难度标签
  source_note text,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE chapter (
  id         bigserial PRIMARY KEY,
  article_id bigint NOT NULL REFERENCES article(id) ON DELETE CASCADE,
  seq        int NOT NULL,
  title      text,
  UNIQUE (article_id, seq)
);
CREATE TABLE paragraph (
  id         bigserial PRIMARY KEY,
  chapter_id bigint NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
  seq        int NOT NULL,
  text       text NOT NULL,
  UNIQUE (chapter_id, seq)
);
CREATE TABLE token (
  id           bigserial PRIMARY KEY,
  paragraph_id bigint NOT NULL REFERENCES paragraph(id) ON DELETE CASCADE,
  seq          int NOT NULL,
  surface      text NOT NULL,        -- 原文写法
  char_start   int NOT NULL,
  char_end     int NOT NULL,
  is_word      boolean NOT NULL,     -- 标点和数字为 false
  lemma_id     bigint REFERENCES lemma(id),
  sense_id     bigint REFERENCES sense(id),  -- 导入时选定的词义
  needs_review boolean NOT NULL DEFAULT false,
  UNIQUE (paragraph_id, seq)
);
CREATE INDEX ON token (lemma_id);
CREATE TABLE token_gloss (
  token_id   bigint PRIMARY KEY REFERENCES token(id) ON DELETE CASCADE,
  kid_fr     text,                   -- 孩子版法语解释
  kid_en     text,                   -- 这句话里的英文意思
  generated_by text,                 -- 哪个模型 / 人工
  approved   boolean NOT NULL DEFAULT false
);
CREATE TABLE question (
  id           bigserial PRIMARY KEY,
  article_id   bigint NOT NULL REFERENCES article(id) ON DELETE CASCADE,
  chapter_id   bigint REFERENCES chapter(id),   -- 空 = 整篇题
  seq          int NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('open','choice','writing')),
  prompt       text NOT NULL,
  model_answer text,
  rubric       jsonb                 -- 批改要点，含“是否紧扣题目”
);

-- 用户状态
CREATE TABLE reading_progress (
  user_id        bigint REFERENCES app_user(id),
  article_id     bigint REFERENCES article(id),
  last_chapter   int NOT NULL DEFAULT 1,
  last_paragraph int NOT NULL DEFAULT 1,
  chapters_done  int[] NOT NULL DEFAULT '{}',
  seconds_read   int NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  PRIMARY KEY (user_id, article_id)
);
CREATE TABLE lookup_event (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES app_user(id),
  token_id   bigint NOT NULL REFERENCES token(id),
  lemma_id   bigint REFERENCES lemma(id),
  self_rating text CHECK (self_rating IN ('unknown','vague','known')),
  dwell_ms   int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON lookup_event (user_id, lemma_id, created_at);
CREATE TABLE user_word (
  user_id         bigint REFERENCES app_user(id),
  lemma_id        bigint REFERENCES lemma(id),
  status          text NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','known','ignored')),
  familiarity     smallint NOT NULL DEFAULT 0 CHECK (familiarity BETWEEN 0 AND 5),
  lookup_count    int NOT NULL DEFAULT 0,
  exposure_count  int NOT NULL DEFAULT 0,
  first_token_id  bigint REFERENCES token(id), -- 第一次遇到的原句，用于填空题
  -- FSRS 状态
  fsrs_state      smallint,          -- New / Learning / Review / Relearning
  stability       real,
  difficulty      real,
  due_at          timestamptz,
  reps            int NOT NULL DEFAULT 0,
  lapses          int NOT NULL DEFAULT 0,
  last_review_at  timestamptz,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lemma_id)
);
CREATE INDEX ON user_word (user_id, due_at) WHERE status = 'learning';
CREATE TABLE review_log (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL,
  lemma_id    bigint NOT NULL,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 4), -- Again..Easy
  source      text NOT NULL CHECK (source IN ('lookup','quiz','self')),
  response_ms int,
  state_before jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, lemma_id) REFERENCES user_word(user_id, lemma_id)
);
CREATE TABLE quiz (
  id           bigserial PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES app_user(id),
  week_of      date NOT NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  UNIQUE (user_id, week_of)
);
CREATE TABLE quiz_item (
  id          bigserial PRIMARY KEY,
  quiz_id     bigint NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  seq         int NOT NULL,
  lemma_id    bigint NOT NULL REFERENCES lemma(id),
  item_type   text NOT NULL,          -- meaning / cloze / match / dictation / sentence
  prompt      jsonb NOT NULL,
  expected    jsonb NOT NULL,
  response    jsonb,
  correct     boolean,
  response_ms int,
  answered_at timestamptz
);
CREATE TABLE answer (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES app_user(id),
  question_id bigint NOT NULL REFERENCES question(id),
  body        text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score       numeric,
  feedback    text,
  graded_by   text                   -- parent / claude
);

-- 网站专用角色：只能碰 lecture schema
CREATE ROLE lecture_app LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA lecture TO lecture_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lecture TO lecture_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lecture TO lecture_app;
```

一个常用查询例子——周测选词的第 1 步：

```sql
SELECT lemma_id FROM lecture.user_word
WHERE user_id = $1 AND status = 'learning' AND due_at <= now()
ORDER BY lapses DESC, due_at
LIMIT 20;
```

## 后台 API

一共约 15 个接口，REST + JSON。学生只能读写自己的数据；`/admin/*` 只有家长角色能访问。

| 方法 + 路径 | 谁用 | 做什么 |
|---|---|---|
| `POST /auth/login` | 所有人 | 登录，返回 HttpOnly 会话 cookie |
| `POST /auth/logout` | 所有人 | 登出 |
| `GET /me` | 学生 | 自己的资料、设置、连续天数 |
| `GET /articles` | 学生 | 书架：已发布文章 + 自己的进度 |
| `GET /articles/{id}/chapters/{seq}` | 学生 | 一章的段落、token、词条、她对这些词的熟悉度（一次拿全） |
| `PUT /progress/{articleId}` | 学生 | 保存读到哪、本次阅读秒数（每 30 秒和离开页面时发） |
| `POST /chapters/{id}/complete` | 学生 | 本章读完，记“见到但没查” |
| `POST /lookups` | 学生 | 一次或一批点词事件（支持批量，离线后补发） |
| `GET /words?group=new|learning|mastered` | 学生 | 我的词袋 |
| `GET /quiz/current` | 学生 | 本周测验（没有就当场生成） |
| `POST /quiz/items/{id}/answer` | 学生 | 提交一题，返回对错 + 正确答案 |
| `POST /questions/{id}/answer` | 学生 | 提交阅读理解或写作答案 |
| `POST /admin/articles` | 家长 | 上传处理好的文章包（JSON） |
| `GET /admin/review-queue` | 家长 | 导入时不确定的词义，供修正 |
| `GET /admin/users/{id}/report?week=` | 家长 | 周报：阅读时长、查词数、测验结果、待批改的答案 |
| `PUT /admin/answers/{id}` | 家长 | 写入批改分数和评语 |

**后端技术**：已定为 Python（FastAPI）。spaCy 还原、FSRS（py-fsrs）、Petit Robert 解析脚本都是 Python，导入脚本和 API 服务可以共用一套代码和数据模型。

## 内容管线：每周新文章

你每周只需要提供一篇法语文章（文本、PDF 或照片），其余由一个导入脚本 + Claude 完成，最后你在管理页按“发布”。

1. 你在本 Project 里上传文章，让 Claude 生成“文章包”：切章、每章末尾一个开放式问题、整篇 3–5 个阅读理解题、一个写作题、每题的批改要点。这就是之前做阅读练习的流程，只是输出改成 JSON。
2. 导入脚本（Python，跑在 Mac Studio）：分词 → spaCy 还原 → 查词典 → 本地模型选词义并写孩子版解释 → 写入 `draft` 状态。
3. 你在管理页快速看一下“不确定”列表（预计每篇几十个），勾选本周重点词，发布。

**开放式问题的批改——针对她的已知弱点**

- 每道开放题的批改要点里都有一条“是否只回答了题目问的”：答太宽（列了多个不相干的点）或太窄（编造细节）都要指出来。这是 Mme Leidei 9 月的反馈。
- 答题框上方放一个小提示：“题目问的是……”，强迫她先圈出问题的关键词。
- 家长端可以把本周答案一键导出，发给 Claude 批改；批改结果和英文家长摘要再导回来。第一期先手动做，不接入自动批改。

**文章包格式（简化示例）**

```json
{
  "slug": "2026-w46-metiers-oublies",
  "title": "Métiers oubliés",
  "week_of": "2026-11-16",
  "chapters": [
    {"seq": 1, "title": "Le décrotteur", "paragraphs": ["...", "..."],
     "question": {"kind": "open", "prompt": "Pourquoi ce métier a-t-il disparu ?",
                  "rubric": {"must_answer": "la raison de la disparition", "avoid": "décrire le métier"}}}
  ],
  "questions": [ {"kind": "writing", "prompt": "..."} ],
  "focus_words": ["entamer", "décrotter"]
}
```

## 部署、账号与安全

已定：只在家里内网用，跑在 Mac Studio 上，访问方式和数学练习页一样。不挂外网，这也满足 Petit Robert 内容不公开的要求。

- 进程：一个后端服务（同时供前端静态文件），用 Docker Compose 或 launchd 开机自启；连接现有 Postgres。
- 账号：由你在管理页或命令行创建，没有自助注册。密码用 argon2id 或 bcrypt 哈希。登录失败 5 次锁 5 分钟。
- 会话：HttpOnly + SameSite cookie，有效期 30 天。
- 权限：所有学生接口都从会话里取 user_id，不接受前端传来的 user_id；家长接口检查角色。
- 数据库隔离：网站用 `lecture_app` 角色连接，没有 family_budget 其他 schema 的权限。
- 备份：`pg_dump --schema=lecture` 加入你现有的备份计划，每天一次。
- 孩子数据：只存显示名和学习记录，不存年龄、学校、邮箱。导入脚本调用的是本地模型，她的答案只有在你主动导出时才会发给 Claude。

## 分阶段实施计划

三期，每期结束都能独立使用。第二期开始的条件是第一期她真的在用。

**第一期：能读、能点、能记（目标：面谈前可用）**

- 建 `lecture` schema 和 `lecture_app` 角色
- 导入 Petit Robert 词条（解析脚本已验证）和 Wiktionary 英文释义
- 导入脚本：分词 + spaCy 还原 + 匹配词条（词义暂时取第一条，未接模型）
- 登录、书架、阅读器、点词卡片、夜间模式
- 点词日志 + `user_word` 计数（先不跑 FSRS，但日志完整保留）
- 第一篇文章上线，你先自己读一遍试用

**第二期：复习闭环**

- 接入 FSRS，用第一期的日志回放生成初始状态
- 周挑战：认义、原句填空、法法配对、听写
- 我的词袋页面
- 导入时用本地模型选词义 + 孩子版解释；管理页修正队列
- 家长英文周报

**第三期：阅读理解 + 写作**

- 每章末开放题 + 整篇写作题，答案入库
- 导出/导入批改（Claude 批改 → 回写分数和评语）
- 造句题型进入周挑战
- （可选）外网访问、第二个孩子账号

每一期都可以在 Claude Code 里按本文档直接实现。

## 待定问题

- 后端：Python（FastAPI）
- 词典：Petit Robert 2007（Lingoes .ld2），已解析
- 设备：iPad + 学校 Chromebook
- 部署：只在家里内网
- 文章来源：学校的文本、你选的书，还是由 Claude 按她的水平写？（版权书籍只用于家庭内部使用）
- 翻译给她看英文还是中文？文档按你的要求写了英文，若她中文更好可以加一列。
- 面谈后老师的具体反馈是什么？可能会改变第三期的优先级。

## 参考资料

- [Schmitt, Cobb et al. (2015), Lexical coverage — replication agenda](https://www.lextutor.ca/cover/papers/schmitt_cobb_etal_2015.pdf)
- [Schmitt, Jiang & Grabe (2011), The percentage of words known in a text and reading comprehension](https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf)
- [Roediger & Karpicke, retrieval practice retrospective](https://moodle2.units.it/pluginfile.php/572734/mod_resource/content/1/testing.pdf)
- [Open Spaced Repetition (FSRS)](https://github.com/open-spaced-repetition)
- [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs)
- [fsrs-rs（含 Anki 集成说明）](https://github.com/open-spaced-repetition/fsrs-rs)
- [@squeakyrobot/fsrs（FSRS vs SM-2 说明）](https://github.com/SqueakyRobot/fsrs)
- [wiktextract](https://www.github.com/tatuylonen/wiktextract) · [PyPI](https://pypi.org/project/wiktextract)
- [spaCy fr_core_news_sm](https://huggingface.co/spacy/fr_core_news_sm)
- [LingQ 词状态说明](https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status)

