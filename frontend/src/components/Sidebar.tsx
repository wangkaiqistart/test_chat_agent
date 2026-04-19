/**
 * 侧边栏组件
 */
import React from 'react';
import { Conversations } from '@ant-design/x';
import { Button, Typography } from 'antd';

const { Text } = Typography;

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
interface SidebarProps {
  conversations: any[];
  activeConversationKey: string;
  onConversationChange: (key: string) => void;
  onNewConversation: () => void;
}

// ============ 组件样式 ============
const styles = {
  side: {
    width: 260,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    background: COLORS.bgSecondary,
    borderRight: `1px solid ${COLORS.border}`,
    flexShrink: 0,
    overflow: 'hidden',
  },

  logo: {
    padding: '20px 20px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderBottom: `1px solid ${COLORS.border}`,
  },

  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: `linear-gradient(135deg, ${COLORS.accent}, #34d399)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center' as const,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: -0.5,
  },

  logoText: {
    fontSize: 15,
    fontWeight: 600,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  newChatBtn: {
    margin: 12,
    height: 40,
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgPrimary,
    fontSize: 13,
    fontWeight: 500,
    color: COLORS.textSecondary,
    transition: 'all 0.2s ease',
  },

  conversationsWrapper: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 8px',
  },

  sideFooter: {
    padding: '12px 16px',
    borderTop: `1px solid ${COLORS.border}`,
    fontSize: 11,
    color: COLORS.textTertiary,
  },
};

// ============ 组件 ============
export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationKey,
  onConversationChange,
  onNewConversation,
}) => {
  return (
    <div style={styles.side} className="sidebar">
      <style>{`
        .sidebar::-webkit-scrollbar { display: none; }
        .sidebar:hover .new-chat-btn { background: ${COLORS.bgTertiary}; color: ${COLORS.textPrimary}; border-color: ${COLORS.textTertiary}; }
      `}</style>

      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoIcon}>AI</div>
        <span style={styles.logoText}>LangGraph</span>
      </div>

      {/* 新建会话按钮 */}
      <Button
        className="new-chat-btn"
        style={styles.newChatBtn}
        onClick={onNewConversation}
      >
        + 新建会话
      </Button>

      {/* 会话列表 */}
      <div style={styles.conversationsWrapper}>
        <Conversations
          items={conversations.map((c) => ({
            key: c.key,
            label: c.label,
            timestamp: c.timestamp,
          }))}
          activeKey={activeConversationKey}
          onActiveChange={onConversationChange}
        />
      </div>

      {/* 底部信息 */}
      <div style={styles.sideFooter}>
        <Text type="secondary" style={{ fontSize: 11 }}>v0.1.0</Text>
      </div>
    </div>
  );
};
