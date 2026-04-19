/**
 * Multi-Modal Chat — Phase 1
 * 设计：简约精致风格，参考 Claude/ChatGPT 极简美学
 */
import { message } from 'antd';
import { useXChat, useXConversations } from '@ant-design/x-sdk';
import { XProvider } from '@ant-design/x';

import { langGraphProvider, type LangGraphMessage } from './LangGraphProvider';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { PROMPT_ITEMS } from './components/prompts';

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

  // 新建会话
  const handleNewConversation = () => {
    if (messages.length === 0) {
      messageApi.info('当前已是新会话');
      return;
    }
    const now = Date.now().toString();
    addConversation({
      key: now,
      label: `新会话 ${conversations.length + 1}`,
      group: '今天',
    });
    setActiveConversationKey(now);
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
