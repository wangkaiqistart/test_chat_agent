# Changelog

All notable changes to this project will be documented in this file.

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
