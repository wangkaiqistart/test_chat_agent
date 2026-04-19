/**
 * LangGraph SSE Chat Provider
 * 将后端 SSE 事件解析为 @ant-design/x 的消息格式
 *
 * 后端 SSE 事件:
 * - event: token     → data: {"content": "..."}
 * - event: tool_start  → data: {"tool": "...", "input": "..."}
 * - event: tool_result → data: {"tool": "...", "output": "..."}
 * - event: done     → data: {"type": "done"}
 */
import { AbstractChatProvider, XRequest } from '@ant-design/x-sdk';
import type { SSEOutput, TransformMessage, XRequestOptions } from '@ant-design/x-sdk';

// ============ 类型定义 ============

/** 工具调用项（用于 ThoughtChain） */
export interface ToolCall {
  key: string;
  title: string;
  description: string;
  status: 'loading' | 'success' | 'error' | 'pending';
  content?: string;
}

/** 聊天消息格式 */
export interface LangGraphMessage {
  role: 'user' | 'assistant';
  content: string;
  thoughts?: ToolCall[];  // 思维链/工具调用
}

/** 输入到 onRequest 的参数 */
export interface LangGraphInput {
  session_id: string;
  message: string;
  stream_mode: string;
}

/** transformMessage 接收的 chunk 类型（XRequest 默认解析 SSE 后的格式） */
type ChatOutput = SSEOutput;

// ============ 工具调用追踪（模块级别，非并发安全，适合单会话） ============
let _toolCallKey = 0;

const _genToolKey = () => `tool_${++_toolCallKey}`;

// ============ Provider ============

class LangGraphChatProvider extends AbstractChatProvider<LangGraphMessage, LangGraphInput, ChatOutput> {
  transformParams(
    requestParams: Partial<LangGraphInput>,
    options: XRequestOptions<LangGraphInput, ChatOutput, LangGraphMessage>,
  ): LangGraphInput {
    return {
      ...(options?.params || {}),
      session_id: requestParams.session_id || `session_${Date.now()}`,
      message: requestParams.message || '',
      stream_mode: 'messages',
    };
  }

  transformLocalMessage(requestParams: Partial<LangGraphInput>): LangGraphMessage {
    return {
      role: 'user',
      content: requestParams.message || '',
    };
  }

  transformMessage(info: TransformMessage<LangGraphMessage, ChatOutput>): LangGraphMessage {
    const { originMessage, chunk } = info;
    const eventType = chunk?.event as string | undefined;
    const rawData = chunk?.data as string | undefined;

    // 初始消息
    let msg: LangGraphMessage = originMessage || { role: 'assistant', content: '', thoughts: [] };

    // 非 SSE 事件或空数据
    if (!rawData) {
      return msg;
    }

    // done 事件：结束追踪
    if (eventType === 'done') {
      return msg;
    }

    try {
      const data = JSON.parse(rawData);

      // ========== token 事件：累加文本内容 ==========
      if (eventType === 'token' || (!eventType && data.content !== undefined)) {
        const text = data.content || '';
        msg = {
          ...msg,
          role: 'assistant',
          content: `${msg.content}${text}`,
        };
        return msg;
      }

      // ========== tool_start 事件：添加思维链项 ==========
      if (eventType === 'tool_start') {
        const thoughts = [...(msg.thoughts || []), {
          key: _genToolKey(),
          title: `正在搜索...`,
          description: '',
          status: 'loading' as const,
        }];
        msg = {
          ...msg,
          thoughts,
        };
        return msg;
      }

      // ========== tool_result 事件：更新思维链项状态 ==========
      if (eventType === 'tool_result') {
        const thoughts = [...(msg.thoughts || [])];

        // 找到最后一个 loading 状态的思维链项并更新
        const lastLoadingIndex = thoughts.findIndex(t => t.status === 'loading');
        if (lastLoadingIndex !== -1) {
          thoughts[lastLoadingIndex] = {
            ...thoughts[lastLoadingIndex],
            title: `搜索完成`,
            status: 'success',
          };
        }

        msg = {
          ...msg,
          thoughts,
        };
        return msg;
      }
    } catch {
      // JSON 解析失败，忽略
    }

    return msg;
  }
}

// ============ Provider 实例（useState 保证只创建一次） ============
export const langGraphProvider = new LangGraphChatProvider({
  request: XRequest<LangGraphInput, ChatOutput, LangGraphMessage>('/api/chat', {
    manual: true,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }),
});
