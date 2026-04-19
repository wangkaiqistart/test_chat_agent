/**
 * 聊天区域组件
 */
import React, { useState, useRef, useEffect } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { Flex, Avatar, Button, message } from 'antd';
import {
  CopyOutlined,
  SyncOutlined,
} from '@ant-design/icons';

import { PromptItem } from './prompts';

// ============ 主题色彩（与 App.tsx 同步） ============
const COLORS = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f7f7f8',
  bgTertiary: '#ececef',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  accent: '#10a37f',
  accentHover: '#0d8a6a',
  userBubble: '#10a37f',
  border: '#e5e5e5',
  shadow: 'rgba(0, 0, 0, 0.05)',
};

// ============ 类型定义 ============
interface MessageItem {
  id: string;
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
  status?: string;
}

interface ChatAreaProps {
  messages: MessageItem[];
  isRequesting: boolean;
  onSubmit: (val: string) => void;
  onCancel: () => void;
  promptItems: PromptItem[];
}

// ============ 消息操作按钮 ============
interface MessageFooterProps {
  id?: string;
  content: string;
  status?: string;
}

const MessageFooter: React.FC<MessageFooterProps> = ({ id, content, status }) => {
  if (status === 'loading' || status === 'updating') {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    message.success('已复制');
  };

  const handleRegenerate = () => {
    message.info('重新生成...');
  };

  if (!id) return null;

  return (
    <div className="message-actions">
      <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
        复制
      </Button>
      <Button size="small" icon={<SyncOutlined />} onClick={handleRegenerate}>
        重新生成
      </Button>
    </div>
  );
};

// ============ 组件样式 ============
const styles = {
  chatList: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '24px 20px',
  },

  messageContainer: {
    width: '100%',
    maxWidth: 720,
  },

  placeholder: {
    width: '100%',
    maxWidth: 640,
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },

  welcomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: `linear-gradient(135deg, ${COLORS.accent}, #34d399)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 16,
  },

  welcomeTitle: {
    fontSize: 24,
    fontWeight: 600,
    color: COLORS.textPrimary,
    margin: '0 0 8px',
    letterSpacing: -0.5,
  },

  welcomeDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    margin: '0 0 24px',
    lineHeight: 1.6,
    textAlign: 'center' as const,
  },

  promptGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    justifyContent: 'center',
  },

  promptCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: COLORS.bgSecondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    margin: 4,
  },

  senderWrap: {
    width: '100%',
    maxWidth: 720,
    margin: '0 auto',
    padding: '12px 20px 20px',
  },

  sender: {
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgPrimary,
    boxShadow: `0 2px 8px ${COLORS.shadow}`,
  },

  bubbleList: {
    width: '100%',
  },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },

  userAvatar: {
    background: COLORS.userBubble,
    color: '#fff',
  },

  assistantAvatar: {
    background: `linear-gradient(135deg, ${COLORS.accent}, #34d399)`,
    color: '#fff',
  },
};

// ============ 组件 ============
export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isRequesting,
  onSubmit,
  onCancel,
  promptItems,
}) => {
  const chatListRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // 自动滚动到底部
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [messages]);

  // 处理提交
  const handleSubmit = (val: string) => {
    if (!val) return;
    onSubmit(val);
    setInputValue('');
  };

  // 处理快捷操作点击
  const handlePromptClick = (description: string) => {
    handleSubmit(description);
  };

  return (
    <>
      <style>{`
        .chat-area::-webkit-scrollbar { display: none; }
        .prompt-card:hover {
          background: ${COLORS.bgTertiary};
          border-color: ${COLORS.textTertiary};
          color: ${COLORS.textPrimary};
          transform: translateY(-1px);
        }
        .message-actions {
          display: flex;
          gap: 4px;
          margin-top: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .bubble-item:hover .message-actions {
          opacity: 1;
        }
        .message-actions .ant-btn {
          height: 28px;
          padding: 0 10px;
          font-size: 12px;
          color: ${COLORS.textTertiary};
          background: transparent;
          border: none;
        }
        .message-actions .ant-btn:hover {
          color: ${COLORS.textSecondary};
          background: ${COLORS.bgTertiary};
        }
      `}</style>

      <div className="chat-area" style={styles.chatList} ref={chatListRef}>
        <div style={styles.messageContainer}>
          {messages?.length ? (
            <Bubble.List
              style={styles.bubbleList}
              items={messages.map((i, idx) => ({
                role: i.message.role,
                content: i.message.content,
                key: i.id || idx,
                status: i.status,
                loading: i.status === 'loading',
                className: 'bubble-item',
                avatar: i.message.role === 'user' ? (
                  <Avatar style={{ ...styles.avatar, ...styles.userAvatar }}>U</Avatar>
                ) : (
                  <Avatar style={{ ...styles.avatar, ...styles.assistantAvatar }}>AI</Avatar>
                ),
                footer: (content: string, info: any) => (
                  <MessageFooter
                    content={content}
                    status={info?.status}
                    id={info?.key}
                  />
                ),
              }))}
              roles={{
                assistant: {
                  placement: 'start',
                },
                user: {
                  placement: 'end',
                },
              }}
            />
          ) : (
            <Flex vertical align="center" style={styles.placeholder}>
              {/* 欢迎图标 */}
              <div style={styles.welcomeIcon}>AI</div>

              <h1 style={styles.welcomeTitle}>开始对话</h1>
              <p style={styles.welcomeDesc}>
                基于 LangGraph + Tavily 的智能助手<br />
                支持工具调用和实时搜索
              </p>

              {/* 快捷操作 */}
              <div style={styles.promptGrid}>
                {promptItems.map((prompt) => (
                  <div
                    key={prompt.key}
                    className="prompt-card"
                    style={styles.promptCard}
                    onClick={() => handlePromptClick(prompt.description)}
                  >
                    {prompt.icon}
                    <span>{prompt.description}</span>
                  </div>
                ))}
              </div>
            </Flex>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div style={styles.senderWrap}>
        <Sender
          value={inputValue}
          onSubmit={handleSubmit}
          onChange={setInputValue}
          onCancel={onCancel}
          loading={isRequesting}
          placeholder="输入消息..."
          style={styles.sender}
        />
      </div>
    </>
  );
};
