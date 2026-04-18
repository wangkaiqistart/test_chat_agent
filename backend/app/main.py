"""
FastAPI 应用入口
Phase 0: 最小闭环 - LangGraph 状态机 + SSE 流式输出
"""
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from langchain.chat_models import init_chat_model
from langchain_core.rate_limiters import InMemoryRateLimiter
from pydantic import BaseModel
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from typing import TypedDict, Annotated
import operator
# 2. 配置速率限制器
rate_limiter = InMemoryRateLimiter(
    requests_per_second=5,       # 每秒最多5个请求
    check_every_n_seconds=1.0    # 每1秒检查一次是否超过速率限制
)
temperature=0.7
max_tokens=10000
llm = init_chat_model(
    base_url='https://xiaoai.plus/v1',
    api_key='sk-3FbwACzC2vTkQOXR96N7h3upBBGf6UvwCMsGJa7u1hJzKPGu',
    model_provider='openai',
    model='gpt-4o-mini',
    # rate_limiter= rate_limiter,
    temperature=temperature,  # 温度参数，用于控制模型的随机性，值越小则随机性越小
    max_tokens=max_tokens,  # 最大生成token数

)


# ============ LangGraph State ============
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    session_id: str


# ============ LangGraph 最小图 ============
def build_graph():
    """构建最小 LangGraph — 只有 LLM Node"""
    graph = StateGraph(AgentState)

    def llm_node(state: AgentState) -> AgentState:
        """LLM 节点：简单 echo 回复"""

        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    graph.add_node("llm", llm_node)
    graph.set_entry_point("llm")
    graph.add_edge("llm", END)

    # 使用内存 Checkpointer（Phase 0 用，Phase 1 切换 MySQL）
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# 全局 graph 实例
graph = build_graph()


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
    print("🚀 Backend 启动成功")
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
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    流式对话接口

    Phase 0: 简单 echo 回复
    Phase 1: 接入 Tool 调用
    """
    config = {"configurable": {"thread_id": request.session_id}}

    async def event_generator():
        # 构造消息
        messages = [HumanMessage(content=request.message)]

        # 流式执行 graph
        if request.stream_mode == "messages":
            # 使用 astream 获得流式输出
            async for chunk in graph.astream(
                {"messages": messages, "session_id": request.session_id},
                config=config,
                stream_mode="messages"
            ):
                # chunk 格式: (AIMessageChunk, metadata) 元组
                message_chunk = chunk[0] if isinstance(chunk, tuple) else chunk
                content = getattr(message_chunk, "content", "")
                if content:
                    yield format_sse_event("token", {"content": content})
        else:
            # 非流式模式
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
    """
    Human-in-the-loop 恢复接口
    用户点击 interrupt 按钮后调用此接口
    """
    # Phase 0 暂不实现 interrupt，先预留接口
    return JSONResponse({"status": "not_implemented", "message": "interrupt 功能 Phase 1 再接入"})


# ============ Run ============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
