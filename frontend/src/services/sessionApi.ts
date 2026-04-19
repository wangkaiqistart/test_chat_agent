/**
 * 会话管理 API 服务
 */
import type { ConversationData } from '@ant-design/x-sdk';

const API_BASE = '/api';

export interface Session {
  id: string;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}

interface ListResponse {
  sessions: Session[];
}

interface SessionResponse {
  session: Session;
}

// 获取会话列表（按更新时间倒序）
export async function listSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  const data: ListResponse = await res.json();
  return data.sessions || [];
}

// 获取或创建默认会话（页面加载时调用）
export async function getOrCreateDefaultSession(): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/default`);
  const data: SessionResponse = await res.json();
  return data.session;
}

// 获取单个会话
export async function getSession(sessionId: string): Promise<Session | null> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  const data: SessionResponse = await res.json();
  return data.session || null;
}

// 创建新会话
export async function createSession(): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
  const data: SessionResponse = await res.json();
  return data.session;
}

// 删除会话
export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
}

// 历史消息
export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 获取会话历史消息
export async function getSessionHistory(sessionId: string): Promise<HistoryMessage[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/history`);
  const data = await res.json();
  return data.messages || [];
}

// 转换 Session 为 ConversationData 格式
export function sessionToConversation(session: Session): ConversationData {
  const date = new Date(session.updated_at);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  let group = '更早';
  if (diffHours < 24) group = '今天';
  else if (diffHours < 48) group = '昨天';
  else if (diffHours < 168) group = '本周';

  return {
    key: session.id,
    label: session.title || '新会话',
    group,
  };
}
