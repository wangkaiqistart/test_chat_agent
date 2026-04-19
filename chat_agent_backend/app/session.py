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
        host=host, port=port, user=user, password=password,
        database=db_name, charset="utf8mb4", cursorclass=DictCursor
    )


def init_session_table():
    """初始化会话表"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id INT DEFAULT 1001,
                    title VARCHAR(100) DEFAULT '新会话',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_message TEXT,
                    message_count INT DEFAULT 0,
                    INDEX idx_user_updated (user_id, updated_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
        conn.commit()
    finally:
        conn.close()


def create_session(session_id: str, user_id: int = 1001, title: str = "新会话") -> dict:
    """创建新会话"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """INSERT INTO sessions (id, user_id, title, created_at, updated_at)
                   VALUES (%s, %s, %s, NOW(), NOW())""",
                (session_id, user_id, title)
            )
        conn.commit()
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


def list_sessions(user_id: int = 1001, limit: int = 50) -> List[dict]:
    """获取用户的会话列表（按修改时间倒序）"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, user_id, title, created_at, updated_at, last_message, message_count
                   FROM sessions WHERE user_id = %s ORDER BY updated_at DESC LIMIT %s""",
                (user_id, limit)
            )
            return cursor.fetchall()
    finally:
        conn.close()


def update_session(session_id: str, title: str = None, last_message: str = None) -> Optional[dict]:
    """更新会话（标题、最后消息、消息数+1）"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if title is not None and last_message is not None:
                cursor.execute(
                    """UPDATE sessions SET title = %s, last_message = %s,
                       updated_at = NOW(), message_count = message_count + 1 WHERE id = %s""",
                    (title[:100], last_message[:500] if last_message else None, session_id)
                )
            elif title is not None:
                cursor.execute(
                    """UPDATE sessions SET title = %s, updated_at = NOW()
                       WHERE id = %s""",
                    (title[:100], session_id)
                )
            elif last_message is not None:
                cursor.execute(
                    """UPDATE sessions SET last_message = %s,
                       updated_at = NOW(), message_count = message_count + 1 WHERE id = %s""",
                    (last_message[:500], session_id)
                )
        conn.commit()
        return get_session(session_id)
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


def get_or_create_default_session(user_id: int = 1001) -> dict:
    """获取用户最新会话，如果没有则创建"""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # 获取最新会话
            cursor.execute(
                """SELECT id, user_id, title, created_at, updated_at, last_message, message_count
                   FROM sessions WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1""",
                (user_id,)
            )
            session = cursor.fetchone()
            if session:
                return session
            # 没有会话，创建新会话
            import uuid
            session_id = f"session_{uuid.uuid4().hex[:12]}"
            cursor.execute(
                """INSERT INTO sessions (id, user_id, title, created_at, updated_at)
                   VALUES (%s, %s, '新会话', NOW(), NOW())""",
                (session_id, user_id)
            )
            conn.commit()
            return get_session(session_id)
    finally:
        conn.close()
