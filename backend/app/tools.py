"""
Phase 1: 工具定义
接入 Tavily Web Search 工具
"""
import os
from typing import Optional

# 检查 Tavily API key
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")


def get_tavily_tool():
    """
    获取 Tavily 搜索工具实例

    Returns:
        TavilySearchResults 工具实例，或 None（如果未配置 API key）
    """
    if not TAVILY_API_KEY:
        print("⚠️  TAVILY_API_KEY 未设置，Web Search 工具将不可用")
        return None

    from langchain_tavily import TavilySearchResults

    # 创建 Tavily 搜索工具，最大返回 5 个结果
    tavily_tool = TavilySearchResults(
        max_results=5,
        api_key=TAVILY_API_KEY,
        name="tavily_search",
        description="搜索互联网获取最新信息。当你需要查询实时数据、新闻、或不确定的信息时使用。",
    )

    return tavily_tool


# 全局工具列表（供 LangGraph 使用）
def get_available_tools():
    """获取所有可用的工具列表"""
    tools = []
    tavily = get_tavily_tool()
    if tavily:
        tools.append(tavily)
    return tools