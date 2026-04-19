/**
 * 会话管理 API 服务
 */
import type { ConversationData } from '@ant-design/x-sdk';

const API_BASE = '/api';

// 会话类型
export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}

// 会话列表响应
interface ListSessionsResponse {
  sessions: Session[];
  total: number;
}

// 获取会话列表
export async function listSessions(limit = 50, offset = 0): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions?limit=${limit}&offset=${offset}`);
  const data: ListSessionsResponse = await res.json();
  return data.sessions;
}

// 获取最新会话
export async function getLatestSession(): Promise<Session | null> {
  const res = await fetch(`${API_BASE}/sessions/latest`);
  const data = await res.json();
  return data.session || null;
}

// 创建会话
export async function createSession(title = '新会话'): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  return data.session;
}

// 更新会话标题
export async function updateSessionTitle(sessionId: string, title: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  return data.session;
}

// 删除会话
export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

// 转换 Session 为 ConversationData 格式
export function sessionToConversation(session: Session): ConversationData {
  // 根据时间生成 group
  const date = new Date(session.updated_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  let group = '更早';
  if (diffDays === 0) group = '今天';
  else if (diffDays === 1) group = '昨天';
  else if (diffDays < 7) group = '本周';

  return {
    key: session.id,
    label: session.title || '新会话',
    group,
  };
}
