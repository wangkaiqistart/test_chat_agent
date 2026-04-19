/**
 * Multi-Modal Chat — Phase 1
 * 功能：文本对话 + SSE 流式输出 + Tool Calling 展示 + 会话列表
 */
import React, { useState } from 'react';
import { XProvider, Bubble, Sender, Conversations } from '@ant-design/x';
import { useXChat } from '@ant-design/x-sdk';

import { langGraphProvider } from './LangGraphProvider';
import { useConversations } from './useConversations';

// ============ Bubble 渲染角色配置 ============
const roles = {
  assistant: {
    placement: 'start' as const,
  },
  user: {
    placement: 'end' as const,
  },
};

// ============ 消息内容渲染（含工具调用展示） ============
function renderMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');
  const parts: React.ReactNode[] = [];

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*结果:\s*([^\n]+)$/);
    if (match) {
      parts.push(
        <div key={parts.length} style={{ marginTop: 8 }}>
          <span style={{
            background: '#f0f0f0',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: 'monospace',
            display: 'inline-block',
          }}>
            🔧 工具: {match[1]}
          </span>
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            background: '#fafafa',
            border: '1px solid #e8e8e8',
            borderRadius: 6,
            fontSize: 13,
            color: '#333',
          }}>
            {match[2]}
          </div>
        </div>,
      );
    } else if (line.trim()) {
      parts.push(<span key={parts.length}>{line}</span>);
    }
  }

  return parts.length > 0 ? <div>{parts}</div> : content;
}

// ============ App ============
export default function App() {
  const [input, setInput] = useState('');
  const {
    conversations,
    activeKey,
    setActiveConversation,
    createConversation,
  } = useConversations();

  const { messages, onRequest, isRequesting, abort } = useXChat<
    string,
    string,
    { session_id: string; message: string; stream_mode: string }
  >({
    provider: langGraphProvider as any,
  });

  const handleSubmit = (value: string) => {
    if (!value.trim()) return;
    setInput('');
    onRequest({
      session_id: activeKey,
      message: value,
      stream_mode: 'messages',
    } as any);
  };

  const handleNewChat = () => {
    abort?.();
    createConversation();
  };

  return (
    <XProvider>
      <div style={{ height: '100vh', display: 'flex', padding: 16, gap: 16 }}>
        {/* 会话列表侧边栏 */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={handleNewChat}
            style={{
              marginBottom: 12,
              padding: '8px 16px',
              background: '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            + 新会话
          </button>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <Conversations
              items={conversations.map(c => ({
                key: c.key,
                label: c.label,
                timestamp: c.timestamp,
              }))}
              activeKey={activeKey}
              onActiveChange={setActiveConversation}
            />
          </div>
        </div>

        {/* 聊天区域 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h1 style={{ marginBottom: 16 }}>Multi-Modal Chat</h1>

          <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
            <Bubble.List
              roles={roles}
              items={messages.map(({ id, message, status }) => ({
                key: id,
                role: 'assistant',
                content: message as string,
                loading: status === 'loading',
                contentRender: renderMessageContent,
              }))}
            />
          </div>

          <Sender
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            loading={isRequesting}
            onCancel={abort}
            placeholder="输入消息..."
          />
        </div>
      </div>
    </XProvider>
  );
}
