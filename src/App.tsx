import { useState, useCallback, useRef } from 'react'
import { Bubble, Sender, Welcome, XProvider, Think } from '@ant-design/x'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { ConfigProvider, theme, Avatar } from 'antd'
import { useSSE } from './hooks/useSSE'

// 消息类型定义
interface Message {
  key: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

// 生成唯一 ID
let messageId = 0
const genId = () => `msg_${++messageId}_${Date.now()}`

// 角色配置
const roles = {
  user: {
    placement: 'end' as const,
    avatar: (
      <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
    ),
  },
  assistant: {
    placement: 'start' as const,
    typing: true,
    avatar: (
      <Avatar icon={<RobotOutlined />} style={{ background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)' }} />
    ),
  },
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const { sendMessage, abort } = useSSE()
  
  // 当前正在流式更新的消息 ID
  const streamingIdRef = useRef<string | null>(null)
  

  // 更新流式消息内容
  const appendContent = useCallback((content: string) => {
    console.log('[App] appendContent called:', content, 'streamingId:', streamingIdRef.current)
    setMessages(prev => {
      const updated = prev.map(msg => 
        msg.key === streamingIdRef.current
          // 收到内容后，关闭 loading 状态以显示内容
          ? { ...msg, content: msg.content + content, loading: false }
          : msg
      )
      console.log('[App] Messages updated:', updated)
      return updated
    })
  }, [])

  // 完成流式消息
  const finishStreaming = useCallback(() => {
    setMessages(prev => prev.map(msg =>
      msg.key === streamingIdRef.current
        ? { ...msg, loading: false }
        : msg
    ))
    streamingIdRef.current = null
    setIsLoading(false)
  }, [])

  // 发送消息
  const handleSend = useCallback((content: string) => {
    if (!content.trim()) return
    
    // 添加用户消息
    const userMessage: Message = {
      key: genId(),
      role: 'user',
      content,
    }
    
    // 创建 AI 消息占位
    const aiMessage: Message = {
      key: genId(),
      role: 'assistant',
      content: '',
      loading: true,
    }
    
    streamingIdRef.current = aiMessage.key
    setMessages(prev => [...prev, userMessage, aiMessage])
    setIsLoading(true)
    setInputValue('')
    
    // 发送 SSE 请求
    sendMessage(
      content,
      // onDelta - 收到增量内容
      (delta) => {
        appendContent(delta)
      },
      // onDone - 完成
      () => {
        finishStreaming()
      },
      // onError - 错误
      (error) => {
        console.error('SSE Error:', error)
        setMessages(prev => prev.map(msg =>
          msg.key === streamingIdRef.current
            ? { ...msg, content: '抱歉，发生了错误，请重试。', loading: false }
            : msg
        ))
        streamingIdRef.current = null
        setIsLoading(false)
      }
    )
  }, [sendMessage, appendContent, finishStreaming])

  return (
    <XProvider>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
          },
        }}
      >
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          background: '#f5f5f5',
        }}>
          {/* 头部 */}
          <header style={{
            padding: '16px 24px',
            background: '#fff',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
              }}>
                <RobotOutlined style={{ fontSize: 20 }} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>AI 助手</h1>
                <p style={{ margin: 0, fontSize: 12, color: '#999' }}>基于 Ant Design X 构建</p>
              </div>
            </div>
            
            {/* 状态指示器 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isLoading ? '#faad14' : '#52c41a',
                animation: isLoading ? 'pulse 1.5s infinite' : 'none',
              }} />
              <span style={{ fontSize: 14, color: '#666' }}>
                {isLoading ? '正在输入...' : '在线'}
              </span>
            </div>
          </header>
          
          {/* 消息区域 */}
          <main style={{ 
            flex: 1, 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '24px',
          }}>
            <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {messages.length === 0 ? (
                <Welcome
                  icon={<RobotOutlined style={{ fontSize: 48, color: '#1677ff' }} />}
                  title="欢迎使用 AI 助手"
                  description="我是基于 Ant Design X 构建的智能对话助手，支持 SSE 流式响应。发送一条消息开始对话吧！"
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 32,
                    marginTop: 60,
                  }}
                />
              ) : (
                <>
                  <Bubble.List
                    autoScroll
                    items={messages.map(msg => ({
                      ...msg,
                      ...roles[msg.role],
                      // 为 AI 消息添加思维过程组件（静态示例）
                      ...(msg.role === 'assistant' ? {
                        header: (
                          <Think title="深度思考" style={{ marginBottom: 8 }}>
                            这是一个深度思考的示例内容。AI 正在分析您的问题，考虑多个角度和可能的解决方案...
                          </Think>
                        )
                      } : {})
                    }))}
                    style={{ background: 'transparent', flex: 1 }}
                  />
                </>
              )}
            </div>
          </main>
          
          {/* 输入区域 */}
          <footer style={{
            padding: '16px 24px',
            background: '#fff',
            borderTop: '1px solid #e8e8e8',
          }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <Sender
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSend}
                onCancel={() => {
                  abort()
                  setIsLoading(false)
                  streamingIdRef.current = null
                }}
                loading={isLoading}
                readOnly={isLoading}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              />
              <div style={{ 
                textAlign: 'center', 
                fontSize: 12, 
                color: '#999', 
                marginTop: 8 
              }}>
                演示项目 · Ant Design X + SSE 流式响应
              </div>
            </div>
          </footer>
        </div>
      </ConfigProvider>
    </XProvider>
  )
}

export default App
