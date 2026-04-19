/**
 * Multi-Modal Chat — Phase 1
 * 功能：文本对话 + SSE 流式输出 + Tool Calling 展示
 */
import React, { useState } from 'react';
import { XProvider, Bubble, Sender } from '@ant-design/x';
import { useXChat } from '@ant-design/x-sdk';

import { langGraphProvider } from './LangGraphProvider';

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

  // 检查是否包含工具调用结果（[tool_name] 结果: xxx）
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
      session_id: `session_${Date.now()}`,
      message: value,
      stream_mode: 'messages',
    } as any);
  };

  return (
    <XProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
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
    </XProvider>
  );
}
