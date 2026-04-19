/**
 * Multi-Modal Chat — Phase 1
 */
import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useXChat, useXConversations } from '@ant-design/x-sdk';
import { XProvider } from '@ant-design/x';

import { langGraphProvider, type LangGraphMessage } from './LangGraphProvider';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { PROMPT_ITEMS } from './components/prompts';
import {
  listSessions,
  createSession,
  deleteSession,
  getSession,
  sessionToConversation,
} from './services/sessionApi';

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();

  // 独立管理历史消息状态
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    setConversations,
  } = useXConversations({
    defaultConversations: [],
  });

  const { messages, onRequest, isRequesting, abort } = useXChat<LangGraphMessage>({
    provider: langGraphProvider as any,
    conversationKey: activeConversationKey,
  });

  // 合并历史消息和流式消息
  const allMessages = [...historyMessages, ...messages];

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const sessions = await listSessions();
      if (sessions.length === 0) {
        // 没有会话，创建一个
        const { session: newSession } = await createSession();
        addConversation({
          key: newSession.id,
          label: newSession.title,
          group: '今天',
        });
        setActiveConversationKey(newSession.id);
        return [newSession];
      } else {
        // 有会话，加载列表并激活第一个
        const conversationMetas = sessions.map(sessionToConversation);
        setConversations(conversationMetas);
        setActiveConversationKey(sessions[0].id);
        return sessions;
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
      return [];
    }
  };

  // 页面加载时初始化
  useEffect(() => {
    loadSessions();
  }, []);

  // 切换会话时加载历史消息
  useEffect(() => {
    if (!activeConversationKey) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const result = await getSession(activeConversationKey);
        if (result && result.messages.length > 0) {
          // 转换为 ChatArea 期望的格式
          const msgs = result.messages.map((msg, idx) => ({
            id: `${activeConversationKey}-${idx}`,
            message: {
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              thoughts: [],
            },
            status: 'success' as const,
          }));
          setHistoryMessages(msgs);
        } else {
          setHistoryMessages([]);
        }
      } catch (error) {
        console.error('加载历史消息失败:', error);
        setHistoryMessages([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [activeConversationKey]);

  // 新建会话
  const handleNewConversation = async () => {
    try {
      const { session: newSession } = await createSession();
      // 重新加载列表保持同步
      await loadSessions();
      setActiveConversationKey(newSession.id);
      setHistoryMessages([]);  // 清除历史消息
      messageApi.success('已创建新会话');
    } catch (error) {
      console.error('创建会话失败:', error);
      messageApi.error('创建会话失败');
    }
  };

  // 删除会话
  const handleDeleteConversation = async (key: string) => {
    try {
      await deleteSession(key);
      await loadSessions();
      messageApi.success('会话已删除');
    } catch (error) {
      console.error('删除会话失败:', error);
      messageApi.error('删除会话失败');
    }
  };

  // 切换会话
  const handleConversationChange = (key: string) => {
    setActiveConversationKey(key);
  };

  // 提交消息
  const handleSubmit = (val: string) => {
    if (!val) return;
    onRequest({
      session_id: activeConversationKey,
      message: val,
      stream_mode: 'messages',
    } as any);
  };

  return (
    <XProvider>
      {contextHolder}
      <div className="app-layout">
        <Sidebar
          conversations={conversations}
          activeConversationKey={activeConversationKey}
          onConversationChange={handleConversationChange}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
        />
        <div className="app-chat">
          <ChatArea
            messages={allMessages as any}
            isRequesting={isRequesting}
            isLoadingHistory={isLoadingHistory}
            onSubmit={handleSubmit}
            onCancel={abort}
            promptItems={PROMPT_ITEMS}
          />
        </div>
      </div>
    </XProvider>
  );
}
