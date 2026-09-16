# Chatlog LLM 与脚本调用手册

本文描述 Web 控制平面、结构化运维 CLI 和 HTTP Catalog 的当前调用契约。

## 基本规则

1. 人工交互统一使用 Web 控制台；无子命令的 `chatlog` 会启动控制台并打开浏览器。
2. 自动化先用 `chatlog ops accounts` 或 `control_accounts` 发现账号。
3. 调用数据接口前执行 `chatlog api catalog --compact`，再用 `chatlog api describe <endpoint>` 读取实际契约。
4. `api` 在 stdout 输出单个 JSON 对象；`ops` 输出 JSON Lines。每次同时检查 `ok` 与进程退出码。
5. 二进制响应必须传 `--output`；需要确认的操作必须传 `--confirm`。
6. 密钥、Token 与 Secret 只写入权限受控的配置请求或文件，不写入日志。
7. 默认地址为 `127.0.0.1:5030`，控制台只在本机 loopback 使用。

## 命令结构

```text
chatlog                         启动并打开 Web 控制台
├── ops
│   ├── accounts
│   ├── status
│   ├── account-select
│   ├── database-key
│   ├── image-key
│   ├── server-start
│   └── config-set
└── api
    ├── catalog
    ├── describe <endpoint>
    ├── openapi
    └── call <endpoint>
```

## 运维 CLI

### 账号和状态

```bash
chatlog ops accounts
chatlog ops status --pid 12345
chatlog ops status --account wxid_example
chatlog ops account-select --pid 12345
chatlog ops account-select --account wxid_example
```

除 `accounts` 与 `config-set` 外，运维命令可通过 `--pid` 或 `--account` 选择目标。

### 密钥任务

```bash
chatlog ops database-key --account wxid_example
chatlog ops image-key --account wxid_example
```

`database-key` 会按 macOS 微信运行流程获取数据库密钥；`image-key` 获取图片解密密钥。进度使用 `action_started`、`state`、`success` 或 `error` JSON Lines 事件报告。

### 配置和长驻服务

```bash
chatlog ops config-set --http-addr 127.0.0.1:5030
chatlog ops config-set --work-dir /absolute/workspace
chatlog ops config-set --data-dir /absolute/wechat-data
chatlog ops config-set --log-retention-days 30
chatlog ops server-start --account wxid_example
```

`config-set` 还支持 `--data-key` 和 `--image-key`。`server-start` 是面向进程编排器的前台长驻模式；桌面使用直接运行 `chatlog`。

事件示例：

```json
{"type":"action_started","action":"server-start","stage":"starting","message":"正在启动 HTTP 服务","timestamp":"2026-08-10T12:00:00+08:00"}
{"type":"success","action":"server-start","stage":"running","message":"HTTP 服务已启动","timestamp":"2026-08-10T12:00:01+08:00"}
```

## Web 控制 API

控制端点不依赖数据库就绪状态：

```text
GET   /api/v1/control/status
GET   /api/v1/control/accounts
PATCH /api/v1/control/config
POST  /api/v1/control/account
POST  /api/v1/control/actions
GET   /api/v1/control/actions/{id}
```

### 更新配置

```bash
chatlog api call control_config --body '{
  "http_addr":"127.0.0.1:5030",
  "work_dir":"/absolute/workspace",
  "data_dir":"/absolute/wechat-data",
  "log_retention_days":30
}'
```

字段省略表示保持不变；密钥字段传空字符串表示清除。监听地址变化会在状态中返回 `restart_required=true`。

### 切换账号

```bash
chatlog api call control_account --body '{"pid":12345}'
chatlog api call control_account --body '{"account":"wxid_example"}'
```

切换只重建账号级数据库、OCR 与推送运行时；Web 控制平面保持在线。

### 异步密钥任务

```bash
chatlog api call control_action_start --body '{"action":"image-key"}'
chatlog api call control_action_get --path-param id=JOB_ID
```

`action` 可选 `image-key` 或 `database-key`。任务状态为 `queued`、`running`、`succeeded` 或 `failed`。同一时刻只运行一个控制任务。

## 契约发现

```bash
chatlog api catalog --compact
chatlog api catalog --category database --compact
chatlog api describe history
chatlog api describe control_config
chatlog api openapi > openapi.json
curl -s http://127.0.0.1:5030/api/v1/openapi.json > openapi.json
```

Catalog、OpenAPI、CLI 校验和服务端路由共用一份 endpoint 定义。描述内容包括 method、path、参数、请求体 schema、side effect、确认要求、响应模式和成功状态码。调用方不应固化 endpoint 总数。

## API 调用

```bash
chatlog api call <endpoint> \
  --addr 127.0.0.1:5030 \
  --timeout 30 \
  --param key=value \
  --path-param key=value \
  --header key=value \
  --body '{"key":"value"}' \
  --confirm \
  --output ./file.bin
```

| 参数 | 用途 |
| --- | --- |
| `--param/-p key=value` | query 参数，可重复 |
| `--path-param key=value` | 填充 path 中的 `{name}` |
| `--header key=value` | 自定义请求头，可重复 |
| `--body '<json>'` | JSON 请求体 |
| `--body-file <path>` | 从文件读取 JSON 请求体 |
| `--confirm` | 允许 Catalog 标记的确认操作 |
| `--output/-o <path>` | 保存媒体或导出文件 |
| `--timeout <seconds>` | 请求超时；`0` 表示不限制 |

CLI 会在发出请求前校验未知参数、必填字段、类型、枚举、数值范围、请求体字段和输出要求。

### 查询示例

```bash
chatlog api call sessions --param query=项目 --param limit=50
chatlog api call history --param chat=filehelper --param time=last-30d --param limit=100
chatlog api call search --param keyword=报价 --param chats=工作群 --param limit=20
chatlog api call contacts --param is_friend=true --param limit=100
chatlog api call database_search --param keyword=项目 --param mode=deep
chatlog api call database_query \
  --param group=message \
  --param file=message_0.db \
  --param 'sql=select count(*) as count from MSG'
```

增量消息通过请求头原样回传服务端游标：

```bash
chatlog api call new_messages --param limit=100
chatlog api call new_messages \
  --header 'X-Chatlog-State=<上一响应 data.new_state 的紧凑 JSON>' \
  --param limit=100
```

`has_more=true` 时继续携带最新 `new_state`。调用方不解析或自行生成该游标。

### 副作用与导出

```bash
chatlog api call cache_clear --confirm
chatlog api call hook_config_set --body-file ./hook-config.json
chatlog api call hook_events_clear --confirm
chatlog api call image --path-param key=MEDIA_KEY --output ./image.jpg
chatlog api call database_data \
  --param group=message \
  --param file=message_0.db \
  --param table=MSG \
  --param format=xlsx \
  --output ./MSG.xlsx
```

JSON 数据使用 `limit`/`offset` 分页。`database_data` 与 `database_query` 在 `csv` 或 `xlsx` 格式下流式导出完整结果。

## 响应

成功：

```json
{
  "ok": true,
  "endpoint": "sessions",
  "method": "GET",
  "url": "http://127.0.0.1:5030/api/v1/sessions?limit=50",
  "status": 200,
  "content_type": "application/json",
  "data": {"sessions": []}
}
```

文件保存：

```json
{
  "ok": true,
  "endpoint": "image",
  "status": 200,
  "content_type": "image/jpeg",
  "saved_to": "/absolute/path/image.jpg",
  "bytes": 12345
}
```

失败时 CLI 仍输出 JSON 并返回非零退出码。直接 HTTP 调用的错误为 `{"error":"..."}`。

## 推荐自动化流程

```text
1. 启动 chatlog，等待 /health
2. control_accounts：发现账号
3. control_account：选择账号
4. control_status：检查数据目录与密钥状态
5. 缺少密钥时创建 control_action_start，并轮询 control_action_get
6. 等待 database_ready=true
7. api catalog + describe
8. 按契约调用数据端点
```

重试策略：

- 连接未建立：确认 Web 进程与监听地址；
- HTTP `503`：数据库启动或切换中，短暂退避并检查 `control_status`；
- HTTP `400`：修正请求，不原样重试；
- HTTP `5xx`：有限指数退避并保留脱敏错误；
- 密钥、配置和账号切换任务只轮询已有任务，不重复创建。
