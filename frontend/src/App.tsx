/**
 * Multi-Modal Chat — Phase 0 最小可运行版本
 * 功能：文本对话 + SSE 流式输出 + ThoughtChain 可视化
 */
import { useState, useRef, useEffect } from 'react'
import { XProvider, Bubble, Sender, Conversations, Thought } from '@ant-design/x'

// SSE 事件类型
type SSEEvent = {
  type: 'token' | 'tool_call' | 'tool_result' | 'card' | 'interrupt' | 'done'
  data: Record<string, unknown>
}

function parseSSE(line: string): SSEEvent | null {
  if (line.startsWith('event:')) {
    const eventType = line.slice(6).trim()
    return null // 等待 data 行
  }
  if (line.startsWith('data:')) {
    try {
      const data = JSON.parse(line.slice(5).trim())
      return null // 需要从 event 行获取 type
    } catch {
      return null
    }
  }
  return null
}

export default function App() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinking, setThinking] = useState(false)
  const conversationId = useRef(`session_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (value: string) => {
    if (!value.trim()) return

    const userMessage = { role: 'user', content: value }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setThinking(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: conversationId.current,
          message: value,
          stream_mode: 'messages',
        }),
      })

      if (!response.ok) throw new Error('请求失败')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantMessage = ''

      setThinking(false)

      while (reader) {
        const { done, value: chunk } = await reader.read()
        if (done) break

        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonData = JSON.parse(line.slice(5).trim())
              const eventType = jsonData.type || 'token'
              const content = jsonData.data?.content || jsonData.content || ''

              if (eventType === 'token' || eventType === 'message') {
                assistantMessage += content
                setMessages(prev => {
                  const last = prev[prev.length - 1]
                  if (last?.role === 'assistant') {
                    return [...prev.slice(0, -1), { role: 'assistant', content: assistantMessage }]
                  }
                  return [...prev, { role: 'assistant', content: assistantMessage }]
                })
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE 错误:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。' }])
    } finally {
      setLoading(false)
      setThinking(false)
    }
  }

  return (
    <XProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
        <h1 style={{ marginBottom: 16 }}>Multi-Modal Chat</h1>

        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          <Conversations
            messages={messages.map((m, i) => ({
              key: i,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              renderComponent: m.role === 'assistant' && thinking && i === messages.length ? (
                <Thought
                  label="思考中..."
                  icon="💭"
                />
              ) : undefined,
            }))}
          />
          <div ref={messagesEndRef} />
        </div>

        <Sender
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={loading}
          placeholder="输入消息..."
        />
      </div>
    </XProvider>
  )
}
