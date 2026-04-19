/**
 * 聊天区域组件 - 多模态版本
 */
import React, { useState, useRef, useEffect } from 'react';
import { Bubble, Sender, ThoughtChain } from '@ant-design/x';
import { Flex, Avatar, Button, message } from 'antd';
import {
  CopyOutlined,
  SyncOutlined,
  PictureOutlined,
  AudioOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

import { PromptItem } from './prompts';
import type { ToolCall } from '../LangGraphProvider';

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
// 图片附件类型
export interface ImageAttachment {
  uid: string;
  name: string;
  url: string;
  status: 'done' | 'uploading' | 'error';
}

// 消息类型（支持多模态）
interface MessageItem {
  id: string;
  message: {
    role: 'user' | 'assistant';
    content: string;
    thoughts?: ToolCall[];
    images?: ImageAttachment[];  // 图片附件
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

  // 图片预览
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid ${COLORS.border}`,
  },

  imagePreviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Web Speech API 语音识别
  const recognitionRef = useRef<any>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [messages]);

  // 处理图片上传
  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ImageAttachment[] = Array.from(files).map((file) => ({
      uid: Math.random().toString(36),
      name: file.name,
      url: URL.createObjectURL(file),
      status: 'done' as const,
    }));
    setAttachments(newAttachments);
    // 清空 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 处理语音输入
  const handleVoiceInput = () => {
    if (isRecording) {
      // 停止录音
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // 检查浏览器支持
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      message.error('当前浏览器不支持语音输入');
      return;
    }

    // 启动语音识别
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        message.error('语音识别出错');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
    message.info('开始语音输入...');
  };

  // 处理提交
  const handleSubmit = (val: string) => {
    // 如果有图片，将附件信息追加到消息内容
    let messageContent = val;
    if (attachments.length > 0) {
      const imageNames = attachments.map(a => a.name).join(', ');
      messageContent = `[图片: ${imageNames}]\n${val}`;
    }
    if (!messageContent) return;
    onSubmit(messageContent);
    setInputValue('');
    setAttachments([]);
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
              items={messages.map((i, idx) => {
                const thoughts = i.message.thoughts;
                return {
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
                  // 思维链放在上方
                  header: thoughts && thoughts.length > 0 ? (
                    <ThoughtChain
                      items={thoughts.map((t) => ({
                        key: t.key,
                        title: t.title,
                        description: t.description,
                        status: t.status === 'loading' ? 'pending' : t.status,
                        collapsible: true,
                        defaultExpanded: false,
                      }))}
                    />
                  ) : undefined,
                  // 操作按钮放在下方
                  footer: (content: string, info: any) => (
                    <MessageFooter
                      content={content}
                      status={info?.status}
                      id={info?.key}
                    />
                  ),
                };
              })}
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

      {/* 输入区域 - 多模态 */}
      <div style={styles.senderWrap}>
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* 图片预览 */}
        {attachments.length > 0 && (
          <Flex gap={8} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {attachments.map((att) => (
              <div key={att.uid} style={styles.imagePreview}>
                <img src={att.url} alt={att.name} style={styles.imagePreviewImg} />
              </div>
            ))}
          </Flex>
        )}

        <Sender
          value={inputValue}
          onSubmit={handleSubmit}
          onChange={setInputValue}
          onCancel={onCancel}
          loading={isRequesting}
          placeholder="输入消息...（支持语音、图片）"
          style={styles.sender}
          // 图片和语音按钮
          prefix={
            <Flex gap={4}>
              <Button
                type="text"
                icon={<PictureOutlined />}
                onClick={handleImageUpload}
                disabled={isRequesting}
              />
              <Button
                type="text"
                icon={isRecording ? <LoadingOutlined /> : <AudioOutlined />}
                onClick={handleVoiceInput}
                disabled={isRequesting}
                style={isRecording ? { color: COLORS.accent } : undefined}
              />
            </Flex>
          }
        />
      </div>
    </>
  );
};
