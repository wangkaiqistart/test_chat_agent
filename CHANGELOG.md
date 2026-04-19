# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-04-19

### Added

- **会话管理 API**: `/api/sessions` 列表、`/api/sessions/{id}` 详情、`DELETE /api/sessions/{id}` 删除
- **会话切换**: 侧边栏显示会话列表，按更新时间倒序排列，点击切换会话
- **历史消息加载**: 切换会话或刷新页面时，从 LangGraph State 恢复聊天历史
- **自动生成标题**: 用户发送第一条消息后，自动提取前30字符作为会话标题
- **新建会话**: 首页无会话时自动创建，刷新页面保持会话连续性
- **加载效果**: 切换会话和刷新页面时显示"加载对话历史..."动画效果
- **删除会话**: 侧边栏支持删除会话，删除后自动刷新列表

### Changed

- **消息格式统一**: `historyMessages` 和 `messages` 分离，兼容两种消息格式
- **ChatArea 组件**: 支持 `isLoadingHistory` 属性，显示加载状态 UI

## [0.1.0.0] - 2026-04-19

### Added

- **Phase 1 LangGraph Agent**: 3-node ReAct graph (`llm_with_tools` → `tool_executor` → `llm_summarize`)
- **Tool Calling**: Tavily Web Search 工具集成，LLM 自动判断是否调用工具
- **SSE 流式输出**: `/api/chat` 支持 SSE 事件流 (`token`, `tool_start`, `tool_result`, `done`)
- **MySQL Checkpointer**: `AIOMySQLSaver` 异步初始化，会话持久化
- **MySQL Store**: `AIOMySQLStore` 异步初始化，长期记忆存储
- **FastAPI 异步 Lifespan**: graph 在 lifespan 内初始化，连接生命周期正确管理
- **前端 Phase 1**: `@ant-design/x` 的 Bubble/Sender 组件实现基础对话 UI

### Changed

- 目录 `backend/` 重命名为 `chat_agent_backend/`
- `config.py`: `ChatOpenAI` 替代 `init_chat_model`，支持自定义 base_url
- `.gitignore`: 新增 `node_modules/`, `dist/`, `__pycache__/`, `.env` 等忽略规则
