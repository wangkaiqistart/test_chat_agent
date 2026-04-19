"""
Phase 1: LangGraph State 定义
"""
from typing import TypedDict, Annotated
import operator


class AgentState(TypedDict):
    """LangGraph Agent 状态"""
    messages: Annotated[list, operator.add]
    session_id: str