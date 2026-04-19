/**
 * 侧边栏组件
 */
import React from 'react';
import { Button, Typography, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

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
interface ConversationItem {
  key: string;
  label?: string;
  group?: string;
  timestamp?: number;
}

interface SidebarProps {
  conversations: ConversationItem[];
  activeConversationKey: string;
  onConversationChange: (key: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (key: string) => void;
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

  sessionGroup: {
    fontSize: 12,
    fontWeight: 500,
    color: COLORS.textTertiary,
    padding: '12px 12px 6px',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  sessionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    marginBottom: 2,
    transition: 'all 0.15s ease',
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  sessionItemActive: {
    background: COLORS.bgPrimary,
    color: COLORS.textPrimary,
    fontWeight: 500,
    boxShadow: `0 1px 3px ${COLORS.shadow}`,
  },

  sessionLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },

  deleteBtn: {
    opacity: 0,
    color: COLORS.textTertiary,
    fontSize: 12,
    padding: 4,
    height: 'auto',
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
  onDeleteConversation,
}) => {
  // 按 group 分组
  const groups: Record<string, ConversationItem[]> = {};
  for (const conv of conversations) {
    const group = conv.group || '更早';
    if (!groups[group]) groups[group] = [];
    groups[group].push(conv);
  }

  // group 排序
  const groupOrder = ['今天', '昨天', '本周', '更早'];
  const sortedGroups = Object.keys(groups).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={styles.side} className="sidebar">
      <style>{`
        .sidebar::-webkit-scrollbar { display: none; }
        .sidebar:hover .new-chat-btn { background: ${COLORS.bgTertiary}; color: ${COLORS.textPrimary}; border-color: ${COLORS.textTertiary}; }
        .session-item:hover .delete-btn { opacity: 1; }
        .session-item:hover .delete-btn:hover { color: #ff4d4f; }
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
        {sortedGroups.map((group) => (
          <div key={group}>
            <div style={styles.sessionGroup}>{group}</div>
            {groups[group].map((conv) => {
              const isActive = conv.key === activeConversationKey;
              return (
                <div
                  key={conv.key}
                  className="session-item"
                  style={{
                    ...styles.sessionItem,
                    ...(isActive ? styles.sessionItemActive : {}),
                  }}
                  onClick={() => onConversationChange(conv.key)}
                >
                  <span style={styles.sessionLabel}>{conv.label}</span>
                  <Popconfirm
                    title="删除会话"
                    description="确定要删除这个会话吗？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDeleteConversation(conv.key);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      className="delete-btn"
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              );
            })}
          </div>
        ))}

        {/* 空状态 */}
        {conversations.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: COLORS.textTertiary, fontSize: 13 }}>
            暂无会话记录
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div style={styles.sideFooter}>
        <Text type="secondary" style={{ fontSize: 11 }}>v0.1.0</Text>
      </div>
    </div>
  );
};
