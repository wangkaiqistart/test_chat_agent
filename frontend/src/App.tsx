/**
 * Multi-Modal Chat — Phase 0 最小可运行版本
 * 功能：文本对话 + SSE 流式输出
 */
import { useState, useRef, useEffect } from 'react'
import { XProvider, Bubble, Sender } from '@ant-design/x'

export default function App() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const conversationId = useRef(`session_${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (value: string) => {
    if (!value.trim()) return

    const userMessage = { role: 'user', content: value }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

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
              const content = jsonData.data?.content || jsonData.content || ''

              assistantMessage += content
              setMessages(prev => {
                const last = prev[prev.length - 1]
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), { role: 'assistant', content: assistantMessage }]
                }
                return [...prev, { role: 'assistant', content: assistantMessage }]
              })
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
    }
  }

  return (
    <XProvider>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
        <h1 style={{ marginBottom: 16 }}>Multi-Modal Chat</h1>

        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          {messages.map((m, i) => (
            <Bubble
              key={i}
              placement={m.role === 'user' ? 'end' : 'start'}
              content={m.content}
            />
          ))}
          {loading && (
            <Bubble placement="start" loading typing={{ step: 1, interval: 50 }} content="" />
          )}
          <div ref={messagesEndRef} />
        </div>

        <Sender
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          loading={loading}
          placeholder="输入消息..."
        />
      </div>
    </XProvider>
  )
}
