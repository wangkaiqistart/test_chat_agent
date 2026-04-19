"""
FastAPI 应用入口
Phase 1: LangGraph 状态机 + Tool Calling + SSE 流式输出
"""
import os
import logging
from contextlib import asynccontextmanager

# 抑制 aiomysql 表已存在的警告
logging.getLogger("aiomysql").setLevel(logging.ERROR)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from langgraph.checkpoint.memory import MemorySaver

from app.graph import build_graph
from app import session as session_db


# ============ API Models ============
class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream_mode: str = "messages"


class CommandRequest(BaseModel):
    session_id: str
    command: dict


class CreateSessionRequest(BaseModel):
    title: str = "新会话"


class UpdateTitleRequest(BaseModel):
    title: str


# ============ FastAPI App ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """异步 lifespan — 在这里初始化 graph（因为需要 event loop）"""
    use_mysql = os.environ.get("USE_MYSQL_CHECKPOINTER", "true").lower() == "true"

    if use_mysql:
        # 方式一：使用 MySQL Checkpointer + Store（异步版本）
        from app.graph import create_mysql_checkpointer, create_mysql_store
        checkpointer = create_mysql_checkpointer()
        async with checkpointer as cp:
            store = create_mysql_store()
            async with store as s:
                await cp.setup()
                await s.setup()
                app.state.graph = build_graph(checkpointer=cp, store=s)
                print("✅ MySQL Checkpointer 初始化成功")
                print("✅ MySQL Store 初始化成功")
                session_db.init_session_table()
                print("✅ 会话表初始化成功")
                print("🚀 Backend Phase 1 启动成功 — Tool Calling enabled")
                yield
        print("👋 Backend 关闭")
    else:
        # 方式二：开发环境使用 MemorySaver + InMemoryStore
        checkpointer = MemorySaver()
        from langgraph.store.memory import InMemoryStore
        store = InMemoryStore()
        print("⚠️  使用 MemorySaver + InMemoryStore（开发模式）")
        app.state.graph = build_graph(checkpointer=checkpointer, store=store)
        print("🚀 Backend Phase 1 启动成功 — Tool Calling enabled")
        yield
        print("👋 Backend 关闭")


app = FastAPI(
    title="Multi-Modal Chat API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ SSE Event Formatter ============
def format_sse_event(event_type: str, data: dict) -> str:
    """将事件格式化为 SSE 格式"""
    import json
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ============ API Endpoints ============
@app.get("/api/health")
async def health():
    """健康检查"""
    return {"status": "ok", "version": "0.1.0", "phase": "phase1"}


# ============ 会话管理 API ============
@app.get("/api/sessions")
async def list_sessions(limit: int = 50, offset: int = 0):
    """获取会话列表（按修改时间倒序）"""
    sessions = session_db.list_sessions(limit=limit, offset=offset)
    return {"sessions": sessions, "total": len(sessions)}


@app.post("/api/sessions")
async def create_session(req: CreateSessionRequest):
    """创建新会话"""
    import uuid
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    new_session = session_db.create_session(session_id, req.title)
    return {"session": new_session}


@app.get("/api/sessions/latest")
async def get_latest_session():
    """获取最后一次更新的会话"""
    latest = session_db.get_latest_session()
    if latest:
        return {"session": latest}
    return {"session": None}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """获取单个会话"""
    sess = session_db.get_session(session_id)
    if sess:
        return {"session": sess}
    return JSONResponse(status_code=404, content={"error": "会话不存在"})


@app.patch("/api/sessions/{session_id}/title")
async def update_session_title(session_id: str, req: UpdateTitleRequest):
    """更新会话标题"""
    updated = session_db.update_session_title(session_id, req.title)
    if updated:
        return {"session": updated}
    return JSONResponse(status_code=404, content={"error": "会话不存在"})


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    success = session_db.delete_session(session_id)
    if success:
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "会话不存在"})


@app.post("/api/chat")
async def chat(request: ChatRequest, http_request: Request):
    """
    流式对话接口 — Phase 1
    支持 Tool Calling，通过 SSE 输出 token
    """
    graph = http_request.app.state.graph
    config = {"configurable": {"thread_id": request.session_id}}

    async def event_generator():
        from langchain_core.messages import HumanMessage
        messages = [HumanMessage(content=request.message)]

        # 确保会话存在
        session_db.create_session(request.session_id, "新会话")

        # 更新会话的最后消息
        session_db.update_session_message(request.session_id, request.message)

        if request.stream_mode == "messages":
            async for event in graph.astream_events(
                {"messages": messages, "session_id": request.session_id},
                config=config,
                version="v1"
            ):
                event_type = event.get("event", "")

                if event_type == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", {})
                    content = getattr(chunk, "content", "")
                    if content:
                        yield format_sse_event("token", {"content": content})

                elif event_type == "on_tool_start":
                    tool_name = event.get("name", "unknown")
                    tool_input = event.get("data", {}).get("input", {})
                    yield format_sse_event("tool_start", {
                        "tool": tool_name,
                        "input": str(tool_input)[:200]
                    })

                elif event_type == "on_tool_end":
                    tool_name = event.get("name", "unknown")
                    tool_output = event.get("data", {}).get("output", "")
                    yield format_sse_event("tool_result", {
                        "tool": tool_name,
                        "output": str(tool_output)[:500]
                    })
        else:
            result = await graph.ainvoke(
                {"messages": messages, "session_id": request.session_id},
                config=config
            )
            final_message = result["messages"][-1]
            yield format_sse_event("message", {"content": final_message.content})

        yield format_sse_event("done", {"type": "done"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/chat/command")
async def chat_command(request: CommandRequest):
    """Human-in-the-loop 恢复接口（Phase 2）"""
    return JSONResponse({"status": "not_implemented", "message": "interrupt 功能 Phase 2 再接入"})


# ============ Run ============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
