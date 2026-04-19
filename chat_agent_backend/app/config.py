"""
配置模块 - LLM 配置和环境变量管理
"""
import os
from dotenv import load_dotenv

# 优先从 backend/.env 读取
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
else:
    load_dotenv()  # 回退到当前目录的 .env

# ============ LLM 配置 ============
from langchain_openai import ChatOpenAI
from langchain_core.rate_limiters import InMemoryRateLimiter

rate_limiter = InMemoryRateLimiter(
    requests_per_second=5,
    check_every_n_seconds=1.0
)
temperature = 0.7
max_tokens = 10000

def get_llm():
    """获取 LLM 实例"""
    return ChatOpenAI(
        base_url='https://xiaoai.plus/v1',
        api_key=os.getenv('OPENAI_API_KEY', 'sk-3FbwACzC2vTkQOXR96N7h3upBBGf6UvwCMsGJa7u1hJzKPGu'),
        model='gpt-4o-mini',
        temperature=temperature,
        max_tokens=max_tokens,
    )

# ============ 数据库配置 ============
DB_URI = os.getenv(
    "DB_URI",
    "mysql+pymysql://remote:123456@152.136.163.231:3306/langchain_db?charset=utf8mb4"
)

# 是否使用 MySQL (默认启用)
USE_MYSQL = os.environ.get("USE_MYSQL_CHECKPOINTER", "true").lower() == "true"
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")