# Chatlog Alpha

> [!IMPORTANT]
> 项目状态、更新通知与用户订阅入口：
> **[加入 Telegram 订阅](https://t.me/+zy1N_8leq8IxYmY8)**

Chatlog Alpha 是面向微信 4.x 的 macOS 本地聊天数据控制台。它发现本机微信账号、管理数据库与图片密钥、只读查询加密 WCDB、解密媒体，并通过 macOS 风格 Web 控制台、本机 HTTP API 和结构化 CLI 提供统一能力。

## 运行方式

项目仅支持 macOS，依赖边界如下：

- 构建需要 Go、Apple Clang 与 CGO；
- Web 前端由浏览器直接加载原生 ES Modules 与 CSS，不需要 npm、打包器或 Node.js 前端构建步骤；
- 朋友圈精确媒体解密会调用 `PATH` 中的 `node`，使用该能力时需要安装 Node.js 运行时。

```bash
make build
make run
```

直接运行 `chatlog` 会启动常驻 Web 控制台并用默认浏览器打开
`http://127.0.0.1:5030`。同一用户只运行一个实例；再次启动会打开正在运行的控制台。

Web 控制平面始终先启动。即使尚未选择账号、数据库目录或密钥，系统设置仍可使用；完成配置后，账号级数据库运行时会独立启动。交互操作全部在 Web 控制台完成，项目不包含终端 UI。

## Web 控制台

- **系统设置**：发现并切换运行中或已保存账号，编辑数据目录、工作目录、监听地址和日志保留天数。
- **密钥任务**：异步提取数据库密钥或图片密钥，展示排队、运行、完成和错误状态。
- **聊天数据**：会话、历史消息、全文搜索、联系人、群聊、收藏和朋友圈。
- **数据库**：模块状态、跨库搜索、只读 SQL、表数据浏览、CSV/XLSX 导出和解析审计。
- **媒体**：图片、视频、语音、附件读取与本地解密预览。
- **OCR**：GLM-OCR 实时识别、历史补录、监听范围、中文文搜图和本地模型生命周期。
- **推送**：POST、Hermes Weixin、Hermes QQ 规则与持久投递队列。
- **运行状态**：日志、HTTP 错误、慢查询、缓存、进程指标和 macOS 文件 I/O 追踪。

界面采用系统字体、侧边栏、分组表单、材质层次、状态胶囊和响应式布局等 macOS 视觉语言。前端按入口编排、共享 HTTP、事件委派、通用 UI、设置、运行状态、数据库、分析、推送和业务功能拆分为原生 ES Modules，不设置独立前端构建步骤。

## 架构

应用采用常驻控制平面与账号运行时分离的模块化架构：

- `internal/chatlog.Application` 负责进程级编排和生命周期；
- `internal/chatlog/modules` 是唯一生产装配点；
- `internal/chatlog/ports` 定义控制、数据库、密钥、媒体和消息变更契约；
- `internal/chatlog/state` 独占配置与当前账号状态，使用原子写入持久化；
- HTTP 传输、数据库、OCR、推送、平台能力通过接口连接；
- 切换账号只重建账号级运行时，Web 控制台和控制 API 保持在线。

详细设计与扩展规则见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 配置与运行数据

默认根目录为 `~/.chatlog`，也可在启动前通过 `CHATLOG_DIR` 整体迁移：

```text
~/.chatlog/
├── chatlog.json
├── chatlog.pid
├── log/
│   ├── chatlog.log
│   └── chatlog-*.log.gz
├── cache/
└── workspaces/<account>/
    ├── runtime/hook.db
    ├── ocr/image_ocr.db
    └── cache/
```

`chatlog.json` 是唯一应用配置文档。网络和日志设置属于应用，数据、密钥、OCR 与推送设置属于账号。配置目录权限为 `0700`，配置文件权限为 `0600`，写入使用同步临时文件与原子替换。

日志每日轮转，单文件达到 50 MB 时提前轮转；历史文件使用 gzip 压缩，默认保留 7 天，可配置为 1–365 天。

## 本机控制 API

系统设置由以下控制端点驱动，它们在数据库尚未就绪时仍可访问：

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/control/status` | 账号、密钥、Web 与数据库状态 |
| `GET` | `/api/v1/control/accounts` | 运行中和已保存账号 |
| `PATCH` | `/api/v1/control/config` | 更新应用或当前账号配置 |
| `POST` | `/api/v1/control/account` | 切换账号并重建账号运行时 |
| `POST` | `/api/v1/control/actions` | 创建密钥提取任务 |
| `GET` | `/api/v1/control/actions/{id}` | 查询任务进度 |

完整 HTTP Catalog 和 OpenAPI 由运行中的程序生成：

```bash
chatlog api catalog --compact
chatlog api describe control_config
chatlog api openapi > openapi.json
```

面向 LLM、Agent 与脚本的调用约定见 [`docs/LLM_CLI.md`](docs/LLM_CLI.md)。

## OCR

OCR 结果存储在独立 SQLite sidecar，并使用 FTS5 trigram 中文子串索引；微信原始数据库保持只读。Apple Silicon 可使用内置的 MLX + GLM-OCR SDK 生命周期，也可配置远程 vLLM 或智谱 MaaS。

部署、队列、水位、历史补录和 API 说明见 [`docs/GLM_OCR.md`](docs/GLM_OCR.md)。

## 安全边界

- HTTP 仅接受 loopback 监听地址，默认 `127.0.0.1:5030`。
- 微信数据库以只读、`query_only` 模式访问；页面按需在内存解密并合并已提交 WAL。
- 状态接口只返回密钥是否存在，不回显密钥、Token 或 Secret。
- 配置、运行时资产与账号工作目录使用当前用户权限。
- Web 控制台应保持本机访问，不通过反向代理、端口映射或隧道公开。

## 构建与发布

```bash
make build       # 当前 macOS 架构
make run         # 构建后启动 Web 控制台
make release     # 生成 amd64/arm64 ZIP 与 SHA256SUMS
```

所有二进制统一启用 CGO、`sqlite_fts5`、`trimpath` 和版本注入，并在生成后核验构建元数据与 `--version`。Node.js 不参与这些构建步骤；运行时仅在朋友圈精确媒体解密时调用 `PATH` 中的 `node`。GitFlic 的 macOS Runner 构建并发布双架构预发布产物，详见 [`docs/GITFLIC_RELEASE.md`](docs/GITFLIC_RELEASE.md)。

## 声明

Chatlog Alpha 为非官方项目，与腾讯或微信不存在隶属、授权或合作关系。“腾讯”“微信”及相关名称和标识归其权利人所有。使用者应遵守所在地法律法规、软件许可和平台规则，并自行负责本地数据与账号安全。
