/**
 * Multi-Modal Chat — Phase 1
 * 设计：简约精致风格，参考 Claude/ChatGPT 极简美学
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
  updateSessionTitle,
  sessionToConversation,
  getLatestSession,
  getSessionHistory,
} from './services/sessionApi';

// ============ App ============
export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [titleUpdated, setTitleUpdated] = useState(false); // 跟踪当前会话标题是否已更新

  // 使用官方 useXConversations 管理会话
  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    removeConversation,
  } = useXConversations({
    defaultConversations: [],
  });

  // 使用 useXChat 管理消息
  const { messages, onRequest, isRequesting, abort, setMessages } = useXChat<LangGraphMessage>({
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
          setTitleUpdated(false);
        } else {
          // 已有会话，重置标题更新状态
          setTitleUpdated(true);
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

  // 切换会话时重置标题更新状态并加载历史消息
  useEffect(() => {
    if (!activeConversationKey) return;

    const loadHistory = async () => {
      try {
        const history = await getSessionHistory(activeConversationKey);
        if (history.length > 0) {
          // 转换为 MessageItem 格式
          const msgs = history.map((msg, idx) => ({
            id: `${activeConversationKey}-${idx}`,
            message: {
              role: msg.role,
              content: msg.content,
            },
            status: 'success' as const,
          }));
          setMessages(msgs);
          setTitleUpdated(true); // 有历史消息说明不是新会话
        } else {
          setTitleUpdated(false);
        }
      } catch (error) {
        console.error('加载历史消息失败:', error);
        setTitleUpdated(false);
      }
    };

    loadHistory();
  }, [activeConversationKey]);

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
      setTitleUpdated(false); // 新会话需要更新标题
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
      // 从前端会话列表移除
      removeConversation(key);
      // 激活其他会话或创建新会话
      if (activeConversationKey === key) {
        const remaining = conversations.filter((c) => c.key !== key);
        if (remaining.length > 0) {
          setActiveConversationKey(remaining[0].key);
        } else {
          // 没有会话了，创建新会话
          handleNewConversation();
        }
      }
      messageApi.success('会话已删除');
    } catch (error) {
      console.error('删除会话失败:', error);
      messageApi.error('删除会话失败');
    }
  };

  // 提交消息
  const handleSubmit = async (val: string) => {
    if (!val) return;

    // 如果是当前会话的第一条消息，更新会话标题
    if (!titleUpdated && activeConversationKey) {
      const newTitle = val.slice(0, 20) + (val.length > 20 ? '...' : '');
      try {
        await updateSessionTitle(activeConversationKey, newTitle);
        setTitleUpdated(true);
      } catch (e) {
        console.error('更新标题失败:', e);
      }
    }

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
