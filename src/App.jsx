import { useState, useCallback, useRef } from 'react'
import MessageList from './components/MessageList'
import ChatInput from './components/ChatInput'
import { useSSE } from './hooks/useSSE'
import { useAutoScroll } from './hooks/useAutoScroll'

// 生成唯一 ID
let messageId = 0
const genId = () => `msg_${++messageId}_${Date.now()}`

function App() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const { sendMessage, abort } = useSSE()
  
  // 当前正在流式更新的消息 ID
  const streamingIdRef = useRef(null)
  
  // 自动滚动 - 依赖消息列表变化
  const { containerRef, handleScroll } = useAutoScroll(messages)

  // 更新流式消息内容（使用函数式更新避免闭包问题）
  const appendContent = useCallback((content) => {
    setMessages(prev => prev.map(msg => 
      msg.id === streamingIdRef.current
        ? { ...msg, content: msg.content + content }
        : msg
    ))
  }, [])

  // 完成流式消息
  const finishStreaming = useCallback(() => {
    setMessages(prev => prev.map(msg =>
      msg.id === streamingIdRef.current
        ? { ...msg, isStreaming: false }
        : msg
    ))
    streamingIdRef.current = null
    setIsLoading(false)
  }, [])

  // 发送消息
  const handleSend = useCallback((content) => {
    // 添加用户消息
    const userMessage = {
      id: genId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    
    // 创建 AI 消息占位
    const aiMessage = {
      id: genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    
    streamingIdRef.current = aiMessage.id
    setMessages(prev => [...prev, userMessage, aiMessage])
    setIsLoading(true)
    
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
          msg.id === streamingIdRef.current
            ? { ...msg, content: '抱歉，发生了错误，请重试。', isStreaming: false }
            : msg
        ))
        streamingIdRef.current = null
        setIsLoading(false)
      }
    )
  }, [sendMessage, appendContent, finishStreaming])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 头部 */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">AI 助手</h1>
              <p className="text-xs text-gray-500">SSE 流式对话演示</p>
            </div>
          </div>
          
          {/* 状态指示器 */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
            <span className="text-sm text-gray-500">
              {isLoading ? '正在输入...' : '在线'}
            </span>
          </div>
        </div>
      </header>
      
      {/* 消息区域 */}
      <main 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        <MessageList messages={messages} />
      </main>
      
      {/* 输入区域 */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}

export default App
