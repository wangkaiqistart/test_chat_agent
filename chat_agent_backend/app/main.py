"""
FastAPI 应用入口
Phase 1: LangGraph 状态机 + Tool Calling + SSE 流式输出
"""
import os
import logging
from contextlib import asynccontextmanager

logging.getLogger("aiomysql").setLevel(logging.ERROR)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from langgraph.checkpoint.memory import MemorySaver

from app.graph import build_graph
from app import session as session_db

DEFAULT_USER_ID = 1001  # 暂时写死的用户 ID


# ============ API Models ============
class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream_mode: str = "messages"


class CommandRequest(BaseModel):
    session_id: str
    command: dict


# ============ FastAPI App ============
@asynccontextmanager
async def lifespan(app: FastAPI):
    use_mysql = os.environ.get("USE_MYSQL_CHECKPOINTER", "true").lower() == "true"

    if use_mysql:
        from app.graph import create_mysql_checkpointer, create_mysql_store
        checkpointer = create_mysql_checkpointer()
        async with checkpointer as cp:
            store = create_mysql_store()
            async with store as s:
                await cp.setup()
                await s.setup()
                app.state.graph = build_graph(checkpointer=cp, store=s)
                session_db.init_session_table()
                print("✅ 初始化完成")
                yield
    else:
        checkpointer = MemorySaver()
        from langgraph.store.memory import InMemoryStore
        store = InMemoryStore()
        app.state.graph = build_graph(checkpointer=checkpointer, store=store)
        print("⚠️  开发模式")
        yield


app = FastAPI(title="Multi-Modal Chat API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def format_sse_event(event_type: str, data: dict) -> str:
    import json
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ============ API Endpoints ============
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/sessions")
async def list_sessions(user_id: int = DEFAULT_USER_ID):
    """获取会话列表（按修改时间倒序）"""
    sessions = session_db.list_sessions(user_id=user_id)
    return {"sessions": sessions}


@app.post("/api/sessions")
async def create_or_get_session(user_id: int = DEFAULT_USER_ID):
    """创建新会话 或 获取默认会话（带历史消息）"""
    import uuid
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    new_session = session_db.create_session(session_id, user_id, "新会话")

    # 获取历史消息
    graph = app.state.graph
    config = {"configurable": {"thread_id": session_id}}
    history = []
    try:
        state = await graph.aget_state(config)
        if state and "messages" in state:
            for msg in state["messages"]:
                role = "user" if getattr(msg, "type", "") == "human" else "assistant"
                content = getattr(msg, "content", "")
                history.append({"role": role, "content": content})
    except:
        pass

    return {"session": new_session, "messages": history}


@app.get("/api/sessions/{session_id}")
async def get_session_with_history(session_id: str, http_request: Request):
    """获取单个会话详情（带聊天记录）"""
    sess = session_db.get_session(session_id)
    if not sess:
        return JSONResponse(status_code=404, content={"error": "会话不存在"})

    # 获取历史消息
    graph = http_request.app.state.graph
    config = {"configurable": {"thread_id": session_id}}
    history = []
    try:
        state = await graph.aget_state(config)
        if state and "messages" in state:
            for msg in state["messages"]:
                role = "user" if getattr(msg, "type", "") == "human" else "assistant"
                content = getattr(msg, "content", "")
                history.append({"role": role, "content": content})
    except:
        pass

    return {"session": sess, "messages": history}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user_id: int = DEFAULT_USER_ID):
    """删除会话"""
    success = session_db.delete_session(session_id)
    if success:
        return {"status": "ok"}
    return JSONResponse(status_code=404, content={"error": "会话不存在"})


@app.get("/api/sessions/{session_id}/history")
async def get_session_history(session_id: str, http_request: Request):
    """获取会话的历史消息"""
    graph = http_request.app.state.graph
    config = {"configurable": {"thread_id": session_id}}

    try:
        state = await graph.aget_state(config)
        if state and "messages" in state:
            messages = state["messages"]
            history = []
            for msg in messages:
                role = "user" if getattr(msg, "type", "") == "human" else "assistant"
                content = getattr(msg, "content", "")
                history.append({"role": role, "content": content})
            return {"messages": history}
        return {"messages": []}
    except Exception as e:
        print(f"获取历史消息失败: {e}")
        return {"messages": []}


def generate_title(user_message: str, assistant_response: str) -> str:
    """根据对话生成标题（取用户问题的前30个字符）"""
    title = user_message[:30]
    if len(user_message) > 30:
        title += "..."
    return title


@app.post("/api/chat")
async def chat(request: ChatRequest, http_request: Request):
    """
    流式对话接口
    支持 Tool Calling，通过 SSE 输出 token
    """
    graph = http_request.app.state.graph
    config = {"configurable": {"thread_id": request.session_id}}

    async def event_generator():
        from langchain_core.messages import HumanMessage
        messages = [HumanMessage(content=request.message)]

        # 更新会话最后消息（会在完成后更新标题）
        session_db.update_session(request.session_id, last_message=request.message)

        full_response = []  # 收集 AI 回复用于生成标题

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
                        full_response.append(content)
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
            full_response.append(final_message.content)
            yield format_sse_event("message", {"content": final_message.content})

        # 生成标题并更新会话
        title = generate_title(request.message, "".join(full_response))
        session_db.update_session(request.session_id, title=title, last_message=request.message)

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
    return JSONResponse({"status": "not_implemented"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
