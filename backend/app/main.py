"""
FastAPI 应用入口
Phase 1: LangGraph 状态机 + Tool Calling + SSE 流式输出
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from langchain.chat_models import init_chat_model
from langchain_core.rate_limiters import InMemoryRateLimiter
from pydantic import BaseModel
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from typing import TypedDict, Annotated
import operator

# MySQL Checkpointer (Lane B)
from .checkpointer import get_checkpointer

# ============ LLM 配置 ============
rate_limiter = InMemoryRateLimiter(
    requests_per_second=5,
    check_every_n_seconds=1.0
)
temperature = 0.7
max_tokens = 10000
llm = init_chat_model(
    base_url='https://xiaoai.plus/v1',
    api_key='sk-3FbwACzC2vTkQOXR96N7h3upBBGf6UvwCMsGJa7u1hJzKPGu',
    model_provider='openai',
    model='gpt-4o-mini',
    temperature=temperature,
    max_tokens=max_tokens,
)


# ============ LangGraph State ============
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    session_id: str


# ============ 工具定义 ============
def get_available_tools():
    """获取所有可用的工具列表"""
    from .tools import get_tavily_tool
    tools = []
    tavily = get_tavily_tool()
    if tavily:
        tools.append(tavily)
    return tools


# ============ LangGraph 3 节点 ReAct 图 ============
def build_graph(checkpointer=None):
    """构建 Phase 1 多节点 LangGraph — Tool Calling + Summarize"""
    graph = StateGraph(AgentState)
    tools = get_available_tools()

    # 绑定工具到 LLM
    llm_with_tools = llm
    if tools:
        llm_with_tools = llm.bind_tools(tools)
        print(f"🔧 LLM 已绑定 {len(tools)} 个工具")
    else:
        print("⚠️  没有可用工具，LLM 未绑定工具")

    # Node 1: llm_with_tools — 路由决策
    def llm_with_tools_node(state: AgentState) -> AgentState:
        """LLM 节点：判断是否需要调用工具，或直接响应"""
        messages = state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # Node 2: tool_executor — 执行工具
    def tool_executor_node(state: AgentState) -> AgentState:
        """工具执行节点：执行 LLM 调用的工具"""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

        # 检查最后一条消息是否有 tool_calls
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_calls = last_message.tool_calls
            tool_results = []

            for tool_call in tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]

                # 查找对应的工具
                tool = None
                for t in tools:
                    if hasattr(t, "name") and t.name == tool_name:
                        tool = t
                        break

                if tool:
                    try:
                        # 执行工具
                        result = tool.invoke(tool_args)
                        tool_results.append(
                            ToolMessage(
                                content=str(result),
                                tool_call_id=tool_call["id"]
                            )
                        )
                    except Exception as e:
                        tool_results.append(
                            ToolMessage(
                                content=f"工具执行错误: {str(e)}",
                                tool_call_id=tool_call["id"]
                            )
                        )
                else:
                    tool_results.append(
                        ToolMessage(
                            content=f"未找到工具: {tool_name}",
                            tool_call_id=tool_call["id"]
                        )
                    )

            # 返回工具结果（追加到消息列表）
            return {"messages": tool_results}
        else:
            # 没有工具调用，直接返回
            return {"messages": []}

    # Node 3: llm_summarize — 合成最终回复
    def llm_summarize_node(state: AgentState) -> AgentState:
        """汇总节点：将工具结果合成为最终回复"""
        messages = state["messages"]
        # 使用 LLM 总结工具结果（如果有工具消息）
        has_tool_results = any(isinstance(m, ToolMessage) for m in messages)
        if has_tool_results:
            response = llm_with_tools.invoke(messages)
            return {"messages": [response]}
        else:
            # 没有工具结果，最后一条消息已经是最终响应
            return {"messages": []}

    # 添加节点
    graph.add_node("llm_with_tools", llm_with_tools_node)
    graph.add_node("tool_executor", tool_executor_node)
    graph.add_node("llm_summarize", llm_summarize_node)

    # 设置入口
    graph.set_entry_point("llm_with_tools")

    # 边：llm_with_tools → tool_executor（如果需要调用工具）
    def should_call_tools(state: AgentState) -> Literal["tool_executor", "llm_summarize"]:
        """判断是否需要调用工具"""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tool_executor"
        else:
            return "llm_summarize"

    # 条件边：llm_with_tools 根据是否有 tool_calls 决定下一步
    graph.add_conditional_edges(
        "llm_with_tools",
        should_call_tools,
        {
            "tool_executor": "tool_executor",
            "llm_summarize": "llm_summarize"
        }
    )

    # 边：tool_executor → llm_summarize（工具执行完后汇总）
    graph.add_edge("tool_executor", "llm_summarize")

    # 边：llm_summarize → END
    graph.add_edge("llm_summarize", END)

    # 使用 Checkpointer（通过 checkpointer.py 统一管理）
    # 默认 MemorySaver，通过 USE_MYSQL_CHECKPOINTER=true 切换到 MySQL
    # checkpointer 由 lifespan 异步创建后传入
    actual_checkpointer = checkpointer if checkpointer is not None else get_checkpointer()
    return graph.compile(checkpointer=actual_checkpointer)


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
    """异步 lifespan — 在这里初始化 graph（因为需要 event loop）"""
    # 检查是否启用 MySQL Checkpointer
    use_mysql = os.environ.get("USE_MYSQL_CHECKPOINTER", "false").lower() == "true"

    if use_mysql:
        # MySQL Checkpointer 在 async context 中创建
        checkpointer = await get_checkpointer()
        print("✅ MySQL Checkpointer 初始化成功")
    else:
        # 开发环境使用 MemorySaver
        checkpointer = MemorySaver()
        print("⚠️  使用 MemorySaver（Phase 2 切换到 MySQL）")

    # 在 async context 中构建 graph（传入 checkpointer）
    app.state.graph = build_graph(checkpointer=checkpointer)
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


@app.post("/api/chat")
async def chat(request: ChatRequest, http_request: Request):
    """
    流式对话接口 — Phase 1
    支持 Tool Calling，通过 SSE 输出 token
    """
    # 从 app.state 获取 graph 实例
    graph = http_request.app.state.graph
    config = {"configurable": {"thread_id": request.session_id}}

    async def event_generator():
        # 构造消息
        messages = [HumanMessage(content=request.message)]

        # 流式执行 graph
        if request.stream_mode == "messages":
            # 使用 astream_events 获取事件（包括工具调用）
            async for event in graph.astream_events(
                {"messages": messages, "session_id": request.session_id},
                config=config,
                version="v1"
            ):
                # 获取事件类型
                event_type = event.get("event", "")

                # 工具相关事件
                if event_type == "on_chat_model_stream":
                    # 流式 token 输出
                    chunk = event.get("data", {}).get("chunk", {})
                    content = getattr(chunk, "content", "")
                    if content:
                        yield format_sse_event("token", {"content": content})

                elif event_type == "on_tool_start":
                    # 工具开始执行
                    tool_name = event.get("name", "unknown")
                    tool_input = event.get("data", {}).get("input", {})
                    yield format_sse_event("tool_start", {
                        "tool": tool_name,
                        "input": str(tool_input)[:200]  # 截断过长的输入
                    })

                elif event_type == "on_tool_end":
                    # 工具执行完成
                    tool_name = event.get("name", "unknown")
                    tool_output = event.get("data", {}).get("output", "")
                    yield format_sse_event("tool_result", {
                        "tool": tool_name,
                        "output": str(tool_output)[:500]  # 截断过长的输出
                    })
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
    # Phase 1 暂不实现 interrupt，先预留接口
    return JSONResponse({"status": "not_implemented", "message": "interrupt 功能 Phase 2 再接入"})


# ============ Run ============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
