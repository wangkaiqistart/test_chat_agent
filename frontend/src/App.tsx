/**
 * Multi-Modal Chat — Phase 1
 * 设计：简约精致风格，参考 Claude/ChatGPT 极简美学
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
  sessionToConversation,
  getLatestSession,
} from './services/sessionApi';

// ============ App ============
export default function App() {
  const [messageApi, contextHolder] = message.useMessage();

  // 使用官方 useXConversations 管理会话
  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
  } = useXConversations({
    defaultConversations: [],
  });

  // 使用 useXChat 管理消息
  const { messages, onRequest, isRequesting, abort } = useXChat<LangGraphMessage>({
    provider: langGraphProvider as any,
    conversationKey: activeConversationKey,
  });

  // 页面加载时：获取会话列表和最新会话
  useEffect(() => {
    const initSessions = async () => {
      try {
        // 获取会话列表
        const sessions = await listSessions();
        const conversationMetas = sessions.map(sessionToConversation);

        // 添加到会话列表
        for (const meta of conversationMetas) {
          addConversation(meta);
        }

        // 获取最新会话并激活
        const latest = await getLatestSession();
        if (latest) {
          setActiveConversationKey(latest.id);
        } else if (conversationMetas.length > 0) {
          // 没有最新会话但有历史会话，激活第一个
          setActiveConversationKey(conversationMetas[0].key);
        }

        // 如果没有任何会话，自动创建一个
        if (conversationMetas.length === 0) {
          const newSession = await createSession('新会话');
          addConversation({
            key: newSession.id,
            label: newSession.title,
            group: '今天',
          });
          setActiveConversationKey(newSession.id);
        }
      } catch (error) {
        console.error('初始化会话失败:', error);
        // 出错时创建一个本地会话
        const now = Date.now().toString();
        addConversation({ key: now, label: '新会话', group: '今天' });
        setActiveConversationKey(now);
      }
    };

    initSessions();
  }, []);

  // 新建会话
  const handleNewConversation = async () => {
    try {
      const newSession = await createSession('新会话');
      addConversation({
        key: newSession.id,
        label: newSession.title,
        group: '今天',
      });
      setActiveConversationKey(newSession.id);
      messageApi.success('已创建新会话');
    } catch (error) {
      console.error('创建会话失败:', error);
      messageApi.error('创建会话失败');
    }
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
          onConversationChange={setActiveConversationKey}
          onNewConversation={handleNewConversation}
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
