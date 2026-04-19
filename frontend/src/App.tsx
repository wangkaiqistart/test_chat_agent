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
  getSessionHistory,
  getOrCreateDefaultSession,
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
        // 获取或创建默认会话
        const defaultSession = await getOrCreateDefaultSession();
        addConversation({
          key: defaultSession.id,
          label: defaultSession.title,
          group: '今天',
        });
        setActiveConversationKey(defaultSession.id);

        // 加载完整会话列表
        const sessions = await loadSessions();

        // 如果默认会话不在列表中，添加它
        if (!sessions.find(s => s.id === defaultSession.id)) {
          addConversation({
            key: defaultSession.id,
            label: defaultSession.title,
            group: '今天',
          });
        }
      } catch (error) {
        console.error('初始化失败:', error);
        // 出错时创建一个本地会话
        const now = Date.now().toString();
        addConversation({ key: now, label: '新会话', group: '今天' });
        setActiveConversationKey(now);
      }
    };

    init();
  }, []);

  // 切换会话时加载历史消息
  useEffect(() => {
    if (!activeConversationKey) return;

    const loadHistory = async () => {
      try {
        const history = await getSessionHistory(activeConversationKey);
        if (history.length > 0) {
          const msgs = history.map((msg, idx) => ({
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
      const newSession = await createSession();
      addConversation({
        key: newSession.id,
        label: newSession.title,
        group: '今天',
      });
      setActiveConversationKey(newSession.id);
      setMessages([]);
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

      // 如果删除的是当前会话，切换到第一个
      if (activeConversationKey === key) {
        const remaining = conversations.filter(c => c.key !== key);
        if (remaining.length > 0) {
          setActiveConversationKey(remaining[0].key);
        } else {
          // 没有会话了，创建新的
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
