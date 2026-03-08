# AI 智能技术支持系统

基于 RAG（检索增强生成）架构的企业级智能客服系统，支持技术文档和工单的全生命周期管理，提供基于已审核知识库的精准检索式问答。

---

## 目录

- [系统架构](#系统架构)
- [核心功能](#核心功能)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [Docker 部署](#docker-部署)
- [项目结构](#项目结构)
- [功能详解](#功能详解)
- [API 接口一览](#api-接口一览)
- [配置说明](#配置说明)
- [脚本工具](#脚本工具)
- [常见问题](#常见问题)

---

## 系统架构

```
┌─────────────────────────────────────────────────┐
│              前端 (React 18 + TypeScript)         │
│         Tailwind CSS 4 · Vite · 中英双语 i18n     │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│              后端 (FastAPI + Python)              │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ SQLite   │  │ ChromaDB │  │ LLM 服务      │  │
│  │ 元数据库  │  │ 向量数据库│  │ Claude/DeepSeek│  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                                  │
│  ┌──────────┐  ┌──────────────────────────────┐  │
│  │ Redis    │  │ Celery 异步任务队列           │  │
│  │ (可选)   │  │ 文档解析 · 工单清洗           │  │
│  └──────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 核心功能

| 功能模块 | 说明 |
|---------|------|
| 智能检索问答 | 基于问题指纹的精准检索，展示已审核原始内容，非 AI 生成 |
| 选项式导航 | AI 分析后提供可点击的方向选项，用户选择后直接展示原文 |
| 文档管理 | 上传 PDF/DOCX/PPTX → AI 清洗 → 人工审核 → 入库 |
| 工单管理 | 导入 Excel/JSON → AI 提取字段 → 人工审核 → 入库 |
| 管理面板 | 数据统计、趋势图表、热门问题、成本节约分析 |
| 版本控制 | 文档/工单的编辑历史、快照查看、一键回滚 |
| 用户反馈 | 点赞/点踩、纠错工单创建、反馈统计 |
| 会话管理 | 历史会话列表、继续对话、删除会话 |
| 系统设置 | LLM 配置、API 密钥、检索参数、清洗模板 |
| 中英双语 | 一键切换中文/英文界面 |

---

## 环境要求

- **Python** 3.10+
- **Node.js** 18+
- **Redis**（可选，仅异步清洗任务需要）

---

## 快速开始

### 1. 克隆项目

```bash
git clone <仓库地址>
cd AIagent
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置一个 LLM API Key：

```env
# 二选一即可
ANTHROPIC_API_KEY=sk-ant-xxx      # Claude API
DEEPSEEK_API_KEY=sk-xxx           # DeepSeek API（默认使用）

# 可选
DASHSCOPE_API_KEY=sk-xxx          # 阿里云 DashScope Embedding
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:5173
```

### 3. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 4. 安装前端依赖

```bash
cd frontend
npm install
```

### 5. 启动服务

**启动后端：**
```bash
cd backend
python main.py
```

**启动前端（新终端）：**

```bash
cd frontend
npm run dev
```

**启动 Celery Worker（可选，新终端）：**
```bash
cd backend
celery -A tasks.celery_app worker --loglevel=info
```

### 6. 访问系统

打开浏览器访问 `http://localhost:5173`

**默认管理员账号：**

| 项目 | 值 |
|-----|-----|
| 用户名 | `admin` |
| 密码 | `admin123` |

### 7. 导入示例数据（可选）

```bash
cd backend
python ../scripts/ingest.py
```

---

## Docker 部署

```bash
cp .env.example .env
# 编辑 .env 填入 API Key
docker compose up --build
```

Docker Compose 包含 4 个服务：

| 服务 | 端口 | 说明 |
|-----|------|------|
| `frontend` | 80 | Nginx 托管的 React SPA |
| `backend` | 8000 | FastAPI 应用，含 Swagger 文档 (`/docs`) |
| `celery-worker` | - | 异步任务处理（文档解析、工单清洗） |
| `redis` | 6379 | Celery 消息队列 |

---

## 项目结构

```
AIagent/
├── backend/
│   ├── api/                # API 路由处理
│   │   ├── auth.py         # 登录、注册、用户信息
│   │   ├── chat.py         # 智能问答、内容检索
│   │   ├── docs.py         # 文档 CRUD、审核、入库
│   │   ├── tickets.py      # 工单 CRUD、审核、入库
│   │   ├── admin.py        # 管理面板统计数据
│   │   ├── settings.py     # 系统设置读写
│   │   ├── feedback.py     # 用户反馈与纠错工单
│   │   ├── versions.py     # 版本历史与回滚
│   │   ├── sessions.py     # 会话历史管理
│   │   └── tasks.py        # Celery 任务状态查询
│   ├── core/               # 核心业务逻辑
│   │   ├── pipeline.py     # RAG 检索管线
│   │   ├── retriever.py    # 向量检索 + 指纹查询
│   │   ├── indexer.py      # 问题指纹索引构建
│   │   ├── fingerprint_extractor.py  # AI 问题指纹提取
│   │   ├── llm.py          # LLM 调用（Claude/DeepSeek）
│   │   ├── embeddings.py   # 文本向量化
│   │   ├── auth.py         # JWT 认证与权限
│   │   ├── parser.py       # 文档解析（PDF/DOCX/PPTX）
│   │   └── cleaner.py      # AI 内容清洗
│   ├── db/                 # 数据库层
│   │   ├── sqlite_db.py    # SQLite 初始化与连接
│   │   ├── chroma_client.py # ChromaDB 集合管理
│   │   ├── fingerprint_store.py # 问题指纹 CRUD
│   │   ├── settings_store.py    # 设置键值存储
│   │   └── version_store.py     # 版本快照存储
│   ├── models/
│   │   └── schemas.py      # Pydantic 数据模型
│   ├── tasks/              # Celery 异步任务
│   │   ├── doc_tasks.py    # 文档解析任务
│   │   └── ticket_tasks.py # 工单清洗任务
│   ├── config.py           # 配置常量
│   ├── main.py             # 应用入口
│   └── requirements.txt    # Python 依赖
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   ├── LoginPage.tsx       # 登录页
│   │   │   ├── ChatPage.tsx        # 智能问答页
│   │   │   ├── AdminDashboard.tsx  # 管理面板
│   │   │   ├── DocsListPage.tsx    # 文档列表
│   │   │   ├── DocReviewPage.tsx   # 文档审核
│   │   │   ├── TicketsListPage.tsx # 工单列表
│   │   │   ├── TicketReviewPage.tsx# 工单审核
│   │   │   └── SettingsPage.tsx    # 系统设置
│   │   ├── components/     # 可复用组件
│   │   │   ├── chat/       # 聊天相关组件
│   │   │   ├── admin/      # 管理相关组件
│   │   │   └── ui/         # 通用 UI 组件
│   │   └── lib/
│   │       ├── api.ts      # API 客户端
│   │       ├── auth.ts     # Token 管理
│   │       └── i18n.tsx    # 国际化（中/英）
│   └── package.json
│
├── scripts/
│   ├── ingest.py           # 示例数据导入
│   └── rebuild_index.py    # 重建问题指纹索引
│
├── data/
│   ├── docs/               # 示例技术文档（Markdown）
│   └── tickets/            # 示例工单（JSON）
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 功能详解

### 智能检索问答

系统采用**问题指纹 + 多级索引**架构，而非传统的 AI 生成式回答：

1. **用户提问** → 系统在 ChromaDB 的 `question_index` 集合中检索匹配的问题指纹
2. **匹配结果聚合** → 按实体（文档/工单）去重，保留最高置信度
3. **展示导航选项** → 如果匹配结果 ≤3 个，直接展示；>3 个则由 AI 归纳为 2-5 个方向
4. **用户点击选项** → 直接从 SQLite 读取已审核的原始内容展示（无 LLM 调用，极快）

**优势：** 不混合多篇文档生成答案，避免幻觉，节省 Token，响应快速。

### 数据审核流程

```
上传/导入 → 待处理 → AI 清洗/提取 → 待审核 → 人工审核 → 已审核（入库）
                                                    ↓
                                                  已驳回
```

- 只有状态为 `已审核` 的内容才会被索引到 ChromaDB，用于检索
- 审核通过时自动提取问题指纹并建立索引
- 驳回或删除时自动清理对应的指纹和向量数据

### 文档管理

| 操作 | 说明 |
|-----|------|
| 上传 | 支持 PDF、DOCX、PPTX 格式，批量上传 |
| AI 清洗 | 自动解析文档内容，提取结构化文本（需 Celery + Redis） |
| 人工审核 | 对比原始内容与 AI 清洗结果，可编辑后审核 |
| 重新清洗 | 对清洗结果不满意可触发重新清洗 |
| 批量操作 | 支持批量审核、驳回、删除 |
| 版本历史 | 每次编辑自动保存快照，支持回滚 |

### 工单管理

| 操作 | 说明 |
|-----|------|
| 导入 | 支持 Excel (.xlsx) 和 JSON 格式 |
| AI 提取 | 自动提取现象、根因、对策三个字段（需 Celery + Redis） |
| 人工审核 | 查看原始工单内容，编辑提取字段后审核 |
| 批量操作 | 支持批量审核、驳回、删除 |

### 管理面板

- **统计卡片**：待审核文档数、待审核工单数、已入库总数、反馈统计
- **趋势图表**：按天展示新增文档、工单、会话数量
- **热门问题**：用户高频提问排行
- **成本节约**：基于已解决查询数估算的人工成本节约

---

## API 接口一览

### 认证 `/api/auth`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| POST | `/api/auth/login` | 无（限流 5次/分钟） | 登录，返回 JWT Token |
| POST | `/api/auth/register` | 管理员 | 注册新用户 |
| GET | `/api/auth/me` | 登录用户 | 获取当前用户信息 |

### 智能问答 `/api/chat`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| POST | `/api/chat` | 登录用户 | 发送消息，触发检索管线 |
| POST | `/api/chat/retrieve` | 登录用户 | 获取选中实体的完整内容（纯数据库查询，无 LLM） |

### 文档 `/api/docs`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| POST | `/api/docs/upload` | 管理员 | 批量上传文档（PDF/DOCX/PPTX） |
| GET | `/api/docs` | 登录用户 | 文档列表（支持筛选、搜索、分页） |
| GET | `/api/docs/{id}` | 登录用户 | 文档详情 |
| PATCH | `/api/docs/{id}` | 管理员 | 编辑文档内容 |
| PATCH | `/api/docs/{id}/approve` | 管理员 | 审核通过并入库 |
| PATCH | `/api/docs/{id}/reject` | 管理员 | 驳回 |
| POST | `/api/docs/{id}/reclean` | 管理员 | 重新 AI 清洗 |
| DELETE | `/api/docs/{id}` | 管理员 | 删除文档 |
| POST | `/api/docs/batch` | 管理员 | 批量操作（审核/驳回/删除） |

### 工单 `/api/tickets`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| POST | `/api/tickets/import` | 管理员 | 导入工单（Excel/JSON） |
| GET | `/api/tickets` | 登录用户 | 工单列表（支持筛选、搜索、分页） |
| GET | `/api/tickets/{id}` | 登录用户 | 工单详情 |
| PATCH | `/api/tickets/{id}` | 管理员 | 编辑工单字段 |
| PATCH | `/api/tickets/{id}/approve` | 管理员 | 审核通过并入库 |
| PATCH | `/api/tickets/{id}/reject` | 管理员 | 驳回 |
| POST | `/api/tickets/{id}/reclean` | 管理员 | 重新 AI 提取 |
| DELETE | `/api/tickets/{id}` | 管理员 | 删除工单 |
| POST | `/api/tickets/batch` | 管理员 | 批量操作 |

### 管理 `/api/admin`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| GET | `/api/admin/stats` | 管理员 | 仪表盘统计数据 |
| GET | `/api/admin/pending` | 管理员 | 所有待审核项 |
| GET | `/api/admin/trends` | 管理员 | 趋势数据（按天） |
| GET | `/api/admin/hot-topics` | 管理员 | 热门问题排行 |

### 设置 `/api/settings`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| GET | `/api/settings` | 管理员 | 读取所有设置（API Key 脱敏） |
| PATCH | `/api/settings` | 管理员 | 批量更新设置 |
| GET | `/api/settings/status` | 管理员 | 系统健康检查（Redis、ChromaDB） |

### 会话 `/api/sessions`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| GET | `/api/sessions` | 登录用户 | 会话列表（普通用户仅看自己的） |
| GET | `/api/sessions/{id}/messages` | 登录用户 | 获取会话消息记录 |
| DELETE | `/api/sessions/{id}` | 登录用户 | 删除会话 |

### 反馈 `/api/feedback`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| POST | `/api/feedback` | 登录用户 | 对消息点赞/点踩 |
| POST | `/api/feedback/ticket` | 登录用户 | 创建纠错工单 |
| GET | `/api/feedback/stats` | 登录用户 | 反馈统计 |
| GET | `/api/feedback/tickets` | 登录用户 | 纠错工单列表 |
| PATCH | `/api/feedback/tickets/{id}` | 管理员 | 标记纠错工单已处理 |

### 版本历史 `/api/versions`

| 方法 | 路径 | 权限 | 说明 |
|-----|------|-----|------|
| GET | `/api/versions/{type}/{id}` | 登录用户 | 获取版本历史列表 |
| GET | `/api/versions/{type}/{id}/{vid}` | 登录用户 | 查看某版本快照 |
| POST | `/api/versions/{type}/{id}/rollback` | 管理员 | 回滚到指定版本 |
| GET | `/api/audit-log` | 管理员 | 审计日志查询 |

> 后端运行时访问 `http://localhost:8000/docs` 可查看完整的 Swagger 交互式文档。

---

## 配置说明

### 环境变量（`.env`）

| 变量 | 说明 | 默认值 |
|-----|------|-------|
| `ANTHROPIC_API_KEY` | Claude API 密钥 | 无 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 无 |
| `DASHSCOPE_API_KEY` | 阿里云 DashScope Embedding 密钥 | 无 |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379/0` |
| `JWT_SECRET` | JWT 签名密钥 | 自动生成 |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔） | `http://localhost:5173` |

### 系统内置设置（管理面板可修改）

| 设置项 | 说明 | 默认值 |
|-------|------|-------|
| `llm_provider` | LLM 服务商 | `deepseek` |
| `llm_model_deepseek` | DeepSeek 模型名 | `deepseek-chat` |
| `llm_model_claude` | Claude 模型名 | `claude-sonnet-4-5-20250929` |
| `llm_max_tokens` | 最大 Token 数 | `2048` |
| `confidence_threshold` | 检索置信度阈值 | `0.85` |
| `max_rounds` | 对话轮次上限 | `3` |
| `top_k` | 检索 Top-K | `5` |
| `embedding_provider` | Embedding 服务商 | `local`（sentence-transformers） |

---

## 脚本工具

### 导入示例数据

```bash
cd backend
python ../scripts/ingest.py
```

从 `data/docs/` 和 `data/tickets/` 导入示例数据，自动设为"已审核"状态并建立索引。

### 重建问题指纹索引

```bash
cd backend
python ../scripts/rebuild_index.py
```

清空并重建所有已审核文档和工单的问题指纹索引。适用于：
- 首次部署后已有审核数据但未建立指纹索引
- 指纹提取逻辑更新后需要全量重建
- 数据异常需要修复索引

---

## 常见问题

### Q: 登录时提示 Internal Server Error？

确保后端已启动且数据库已初始化。如果数据库损坏，删除 `backend/metadata.db` 后重启后端即可自动重建。

### Q: Redis 状态显示"未连接"？

Redis 仅用于 Celery 异步任务（文档解析、工单清洗）。核心功能（登录、聊天、文档管理）不依赖 Redis，可以忽略。如需异步清洗功能，请安装并启动 Redis。
#   a i a g e n t  
 