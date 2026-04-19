"""
会话管理模块 - 会话 CRUD 操作
使用 MySQL 存储会话信息
"""
import pymysql
from pymysql.cursors import DictCursor
from datetime import datetime
from typing import Optional, List
from app.config import DB_URI


def get_connection():
    """获取数据库连接"""
    # 解析 DB_URI: mysql+pymysql://user:pass@host:port/db?charset=utf8mb4
    uri_parts = DB_URI.replace("mysql+pymysql://", "").split("/")
    auth_host = uri_parts[0]
    db_name = uri_parts[1].split("?")[0]

    auth, host_port = auth_host.split("@")
    user, password = auth.split(":")

    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host = host_port
        port = 3306

    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=db_name,
        charset="utf8mb4",
        cursorclass=DictCursor
    )


def init_session_table():
    """初始化会话表"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 创建会话表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(64) PRIMARY KEY,
                    title VARCHAR(255) DEFAULT '新会话',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_message TEXT,
                    message_count INT DEFAULT 0,
                    INDEX idx_updated_at (updated_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
        conn.commit()
    finally:
        conn.close()


def create_session(session_id: str, title: str = "新会话") -> dict:
    """创建新会话"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO sessions (id, title, created_at, updated_at)
                VALUES (%s, %s, NOW(), NOW())
                ON DUPLICATE KEY UPDATE updated_at=NOW()
                """,
                (session_id, title)
            )
        conn.commit()

        # 返回创建的会话
        return get_session(session_id)
    finally:
        conn.close()


def get_session(session_id: str) -> Optional[dict]:
    """获取单个会话"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM sessions WHERE id = %s", (session_id,))
            return cursor.fetchone()
    finally:
        conn.close()


def list_sessions(limit: int = 50, offset: int = 0) -> List[dict]:
    """获取会话列表（按修改时间倒序）"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, title, created_at, updated_at, last_message, message_count
                FROM sessions
                ORDER BY updated_at DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset)
            )
            return cursor.fetchall()
    finally:
        conn.close()


def update_session_title(session_id: str, title: str) -> Optional[dict]:
    """更新会话标题"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE sessions SET title = %s, updated_at = NOW() WHERE id = %s",
                (title, session_id)
            )
        conn.commit()
        return get_session(session_id)
    finally:
        conn.close()


def update_session_message(session_id: str, last_message: str, increment: bool = True) -> None:
    """更新会话最后消息"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if increment:
                cursor.execute(
                    """
                    UPDATE sessions
                    SET last_message = %s, updated_at = NOW(), message_count = message_count + 1
                    WHERE id = %s
                    """,
                    (last_message[:500], session_id)  # 截断保存
                )
            else:
                cursor.execute(
                    """
                    UPDATE sessions
                    SET last_message = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (last_message[:500], session_id)
                )
        conn.commit()
    finally:
        conn.close()


def delete_session(session_id: str) -> bool:
    """删除会话"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM sessions WHERE id = %s", (session_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def get_latest_session() -> Optional[dict]:
    """获取最后一次更新的会话"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, title, created_at, updated_at, last_message, message_count
                FROM sessions
                ORDER BY updated_at DESC
                LIMIT 1
                """
            )
            return cursor.fetchone()
    finally:
        conn.close()
