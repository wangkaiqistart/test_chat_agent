/**
 * Multi-Modal Chat — Phase 1
 */
import { useEffect } from 'react';
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

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
    setConversations,
  } = useXConversations({
    defaultConversations: [],
  });

  const { messages, onRequest, isRequesting, abort, setMessages } = useXChat<LangGraphMessage>({
    provider: langGraphProvider as any,
    conversationKey: activeConversationKey,
  });

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const sessions = await listSessions();
      const conversationMetas = sessions.map(sessionToConversation);
      setConversations(conversationMetas);
      return sessions;
    } catch (error) {
      console.error('加载会话列表失败:', error);
      return [];
    }
  };

  // 页面加载时初始化
  useEffect(() => {
    const init = async () => {
      try {
        // 创建新会话（同时返回空历史）
        const { session: newSession } = await createSession();
        addConversation({
          key: newSession.id,
          label: newSession.title,
          group: '今天',
        });
        setActiveConversationKey(newSession.id);
        setMessages([]);

        // 加载完整会话列表
        await loadSessions();
      } catch (error) {
        console.error('初始化失败:', error);
        const now = Date.now().toString();
        addConversation({ key: now, label: '新会话', group: '今天' });
        setActiveConversationKey(now);
        setMessages([]);
      }
    };

    init();
  }, []);

  // 切换会话时加载历史消息
  useEffect(() => {
    if (!activeConversationKey) return;

    const loadHistory = async () => {
      try {
        // 从列表中找会话（避免重复请求）
        const existingConv = conversations.find(c => c.key === activeConversationKey);
        if (existingConv) {
          // 已有会话，获取历史
          const result = await getSession(activeConversationKey);
          if (result && result.messages.length > 0) {
            const msgs = result.messages.map((msg, idx) => ({
              id: `${activeConversationKey}-${idx}`,
              message: {
                role: msg.role,
                content: msg.content,
              },
              status: 'success' as const,
            }));
            setMessages(msgs);
          } else {
            setMessages([]);
          }
        }
      } catch (error) {
        console.error('加载历史消息失败:', error);
        setMessages([]);
      }
    };

    loadHistory();
  }, [activeConversationKey]);

  // 新建会话
  const handleNewConversation = async () => {
    try {
      const { session: newSession } = await createSession();
      addConversation({
        key: newSession.id,
        label: newSession.title,
        group: '今天',
      });
      setActiveConversationKey(newSession.id);
      setMessages([]);
      // 刷新列表以保持顺序
      await loadSessions();
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
      removeConversation(key);
      await loadSessions();

      if (activeConversationKey === key) {
        const remaining = conversations.filter(c => c.key !== key);
        if (remaining.length > 0) {
          setActiveConversationKey(remaining[0].key);
        } else {
          handleNewConversation();
        }
      }
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
            messages={messages as any}
            isRequesting={isRequesting}
            onSubmit={handleSubmit}
            onCancel={abort}
            promptItems={PROMPT_ITEMS}
          />
        </div>
      </div>
    </XProvider>
  );
}
