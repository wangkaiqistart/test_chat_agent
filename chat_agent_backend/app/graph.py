"""
Phase 1: LangGraph 图构建
3节点 ReAct: llm_with_tools → tool_executor → llm_summarize

设计决策：
- checkpointer 和 store 由调用者（main.py）传入
- build_graph() 只负责构建节点和边，返回编译好的 graph
- 这样做的好处：职责分离，编译时机由调用者控制
"""
from typing import Literal, Optional

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore

from app.state import AgentState
from app.tools import get_available_tools
from app.config import get_llm, DB_URI


def create_mysql_checkpointer():
    """
    创建 MySQL Checkpointer（异步版本，使用 async with 语句管理生命周期）
    """
    from langgraph.checkpoint.mysql.aio import AIOMySQLSaver
    return AIOMySQLSaver.from_conn_string(DB_URI)


def create_mysql_store():
    """
    创建 MySQL Store（异步版本，使用 async with 语句管理生命周期）
    """
    from langgraph.store.mysql import AIOMySQLStore
    return AIOMySQLStore.from_conn_string(DB_URI)


# 全局 LLM 实例（延迟初始化）
_llm = None


def get_llm_instance():
    """获取 LLM 单例，延迟初始化"""
    global _llm
    if _llm is None:
        _llm = get_llm()
    return _llm


def build_graph(
    checkpointer: Optional[BaseCheckpointSaver] = None,
    store: Optional[BaseStore] = None,
):
    """
    构建 Phase 1 多节点 LangGraph — Tool Calling + Summarize

    节点:
    1. llm_with_tools — 判断是否需要调用工具，或直接响应
    2. tool_executor — 执行 LLM 调用的工具
    3. llm_summarize — 将工具结果合成为最终回复

    Args:
        checkpointer: 可选，checkpoint 保存器（用于会话持久化）
        store: 可选，长期记忆存储
    """
    llm = get_llm_instance()
    tools = get_available_tools()

    # 绑定工具到 LLM
    llm_with_tools = llm
    if tools:
        llm_with_tools = llm.bind_tools(tools)
        print(f"🔧 LLM 已绑定 {len(tools)} 个工具")
    else:
        print("⚠️  没有可用工具，LLM 未绑定工具")

    # ============ Node 1: llm_with_tools ============
    def llm_with_tools_node(state: AgentState) -> AgentState:
        """LLM 节点：判断是否需要调用工具，或直接响应"""
        messages = state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # ============ Node 2: tool_executor ============
    def tool_executor_node(state: AgentState) -> AgentState:
        """工具执行节点：执行 LLM 调用的工具"""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

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
                        result = tool.invoke(tool_args)
                        from langchain_core.messages import ToolMessage
                        tool_results.append(
                            ToolMessage(
                                content=str(result),
                                tool_call_id=tool_call["id"]
                            )
                        )
                    except Exception as e:
                        from langchain_core.messages import ToolMessage
                        tool_results.append(
                            ToolMessage(
                                content=f"工具执行错误: {str(e)}",
                                tool_call_id=tool_call["id"]
                            )
                        )
                else:
                    from langchain_core.messages import ToolMessage
                    tool_results.append(
                        ToolMessage(
                            content=f"未找到工具: {tool_name}",
                            tool_call_id=tool_call["id"]
                        )
                    )

            return {"messages": tool_results}
        else:
            return {"messages": []}

    # ============ Node 3: llm_summarize ============
    def llm_summarize_node(state: AgentState) -> AgentState:
        """汇总节点：将工具结果合成为最终回复"""
        messages = state["messages"]
        from langchain_core.messages import ToolMessage
        has_tool_results = any(isinstance(m, ToolMessage) for m in messages)
        if has_tool_results:
            response = llm_with_tools.invoke(messages)
            return {"messages": [response]}
        else:
            return {"messages": []}

    # ============ 构建图 ============
    graph = StateGraph(AgentState)

    graph.add_node("llm_with_tools", llm_with_tools_node)
    graph.add_node("tool_executor", tool_executor_node)
    graph.add_node("llm_summarize", llm_summarize_node)

    graph.set_entry_point("llm_with_tools")

    # 条件边：llm_with_tools 根据是否有 tool_calls 决定下一步
    def should_call_tools(state: AgentState) -> Literal["tool_executor", "llm_summarize"]:
        """判断是否需要调用工具"""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tool_executor"
        else:
            return "llm_summarize"

    graph.add_conditional_edges(
        "llm_with_tools",
        should_call_tools,
        {
            "tool_executor": "tool_executor",
            "llm_summarize": "llm_summarize"
        }
    )

    # 边：tool_executor → llm_summarize
    graph.add_edge("tool_executor", "llm_summarize")

    # 边：llm_summarize → END
    graph.add_edge("llm_summarize", END)

    # 编译：使用传入的 checkpointer 和 store
    return graph.compile(checkpointer=checkpointer, store=store)
