/**
 * 会话管理 Hook
 * 管理会话列表的创建、切换、删除（持久化到 localStorage）
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface Conversation {
  key: string;
  label: string;
  timestamp: number;
}

const STORAGE_KEY = 'multimodal_chat_conversations';

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // ignore
  }
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeKey, setActiveKeyState] = useState<string>(() => {
    const saved = loadConversations();
    return saved[0]?.key || '';
  });

  // 防止 Strict Mode 下 useEffect 重复执行导致重复创建会话
  const initRef = useRef(false);

  // 持久化
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // 创建新会话
  const createConversation = useCallback((): string => {
    const key = `session_${Date.now()}`;
    const conv: Conversation = {
      key,
      label: `会话 ${conversations.length + 1}`,
      timestamp: Date.now(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveKeyState(key);
    return key;
  }, [conversations.length]);

  // 切换会话
  const setActiveConversation = useCallback((key: string) => {
    setActiveKeyState(key);
    // 更新时间戳
    setConversations(prev =>
      prev.map(c => (c.key === key ? { ...c, timestamp: Date.now() } : c)),
    );
  }, []);

  // 删除会话
  const removeConversation = useCallback((key: string) => {
    setConversations(prev => {
      const remaining = prev.filter(c => c.key !== key);
      // 如果删除的是当前会话，切换到第一个
      if (activeKey === key && remaining.length > 0) {
        setActiveKeyState(remaining[0].key);
      }
      return remaining;
    });
  }, [activeKey]);

  // 确保至少有一个会话
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (conversations.length === 0) {
      createConversation();
    }
  }, [conversations.length]); // 依赖 conversations.length 用于后续创建场景

  return {
    conversations,
    activeKey,
    activeConversation: conversations.find(c => c.key === activeKey),
    setActiveConversation,
    createConversation,
    removeConversation,
  };
}
