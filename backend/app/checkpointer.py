"""
Phase 1: MySQL Checkpoint Saver
使用 AIOMySQLSaver 实现对话持久化
"""
import os
from typing import Optional

# 数据库连接 URI
DB_URI = os.environ.get(
    "DB_URI",
    "mysql+pymysql://remote:123456@152.136.163.231:3306/langchain_db?charset=utf8mb4"
)


async def create_checkpointer():
    """
    创建 MySQL Checkpointer（异步）

    使用 AIOMySQLSaver（异步版本，适配 FastAPI async 端点）
    Phase 1 开发环境使用，生产环境建议配置连接池参数

    Returns:
        AIOMySQLSaver 实例，用于 LangGraph compile(checkpointer=...)
    """
    import aiomysql
    from langgraph.checkpoint.mysql.aio import AIOMySQLSaver

    # 从 DB_URI 解析连接参数
    # URI 格式: mysql+pymysql://user:pass@host:port/dbname?charset=utf8mb4
    uri = DB_URI.replace("mysql+pymysql://", "")

    # 解析 user:pass@host:port/dbname
    if "@" in uri:
        auth, rest = uri.split("@", 1)
        user, password = auth.split(":", 1)
    else:
        user, password, rest = "remote", "123456", uri

    if "/" in rest:
        host_port, dbname = rest.split("/", 1)
        dbname = dbname.split("?")[0]  # 去掉查询参数
    else:
        host_port, dbname = rest, "langchain_db"

    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host, port = host_port, 3306

    # _connect 是同步函数，返回协程对象
    # AIOMySQLSaver 内部会在 running loop 上 schedule 这个协程
    def _connect():
        return aiomysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            db=dbname,
            autocommit=True,
        )

    # 传入 connection factory 而非 URI
    checkpointer = AIOMySQLSaver(_connect)

    print(f"✅ MySQL Checkpointer 创建成功 (AIOMySQLSaver)")
    print(f"   连接: {host}:{port}/{dbname}")

    return checkpointer


def create_sync_checkpointer():
    """
    创建同步版 MySQL Checkpointer（备选）

    使用 PyMySQLSaver（同步版本），适用于同步场景或调试

    Returns:
        PyMySQLSaver 实例
    """
    from langgraph.checkpoint.mysql.pymysql import PyMySQLSaver

    checkpointer = PyMySQLSaver.from_uri(DB_URI)

    print(f"✅ MySQL Checkpointer 创建成功 (PyMySQLSaver)")

    return checkpointer


# 全局 checkpointer 实例（延迟初始化）
_checkpointer: Optional[object] = None


async def get_checkpointer():
    """
    获取全局 checkpointer 实例（单例模式，异步）

    Phase 1 使用 MemorySaver 快速验证
    Phase 2 切换到 MySQL Checkpointer

    Returns:
        checkpointer 实例
    """
    global _checkpointer

    if _checkpointer is not None:
        return _checkpointer

    # 优先使用 AIOMySQLSaver
    use_mysql = os.environ.get("USE_MYSQL_CHECKPOINTER", "false").lower() == "true"

    if use_mysql:
        _checkpointer = await create_checkpointer()
    else:
        # Phase 1 暂用 MemorySaver，MySQL 作为 Phase 2 目标
        from langgraph.checkpoint.memory import MemorySaver
        _checkpointer = MemorySaver()
        print("⚠️  使用 MemorySaver（Phase 2 切换到 MySQL）")

    return _checkpointer


def init_mysql_schema():
    """
    初始化 MySQL Schema（仅首次使用时调用）

    创建必要的表结构供 AIOMySQLSaver 使用

    Raises:
        Exception: 如果连接失败或 Schema 初始化失败
    """
    import asyncio
    import aiomysql

    # 从 DB_URI 解析连接参数
    # URI 格式: mysql+pymysql://user:pass@host:port/dbname?charset=utf8mb4
    uri = DB_URI.replace("mysql+pymysql://", "")

    # 解析 user:pass@host:port/dbname
    if "@" in uri:
        auth, rest = uri.split("@", 1)
        user, password = auth.split(":", 1)
    else:
        user, password, rest = "remote", "123456", uri

    if "/" in rest:
        host_port, dbname = rest.split("/", 1)
        dbname = dbname.split("?")[0]  # 去掉查询参数
    else:
        host_port, dbname = rest, "langchain_db"

    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host, port = host_port, 3306

    async def _init():
        pool = await aiomysql.create_pool(
            host=host,
            port=port,
            user=user,
            password=password,
            db=dbname,
            autocommit=True,
            minsize=1,
            maxsize=5,
        )
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                # LangGraph checkpointer 需要两个表
                # 1. checkpoints: 存储图状态快照
                await cur.execute("""
                    CREATE TABLE IF NOT EXISTS checkpoints (
                        thread_id VARCHAR(255) NOT NULL,
                        checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
                        type VARCHAR(255) NOT NULL,
                        checkpoint MEDIUMTEXT NOT NULL,
                        parent_checkpoint_ns VARCHAR(255) DEFAULT '',
                        parent_checkpoint_id VARCHAR(255) DEFAULT '',
                        PRIMARY KEY (thread_id, checkpoint_ns)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
                # 2. checkpoint_writes: 存储写锁状态
                await cur.execute("""
                    CREATE TABLE IF NOT EXISTS checkpoint_writes (
                        thread_id VARCHAR(255) NOT NULL,
                        checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
                        checkpoint_id VARCHAR(255) NOT NULL,
                        type VARCHAR(255) NOT NULL,
                        channel VARCHAR(255) NOT NULL,
                        write MEDIUMTEXT NOT NULL,
                        PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, type, channel)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """)
        pool.close()
        await pool.wait_closed()
        print("✅ MySQL Schema 初始化完成")

    try:
        asyncio.run(_init())
    except Exception as e:
        print(f"❌ MySQL Schema 初始化失败: {e}")
        raise
