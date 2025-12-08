import { memo } from 'react'

/**
 * 聊天气泡组件
 * 使用 memo 优化，避免不必要的重渲染
 */
const ChatBubble = memo(function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  const isStreaming = message.isStreaming
  
  return (
    <div 
      className={`message-enter flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {/* 头像 */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium mr-3">
          AI
        </div>
      )}
      
      {/* 气泡内容 */}
      <div 
        className={`
          max-w-[70%] px-4 py-3 rounded-2xl
          ${isUser 
            ? 'bg-blue-500 text-white rounded-br-md' 
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }
          ${isStreaming ? 'typing-cursor' : ''}
        `}
      >
        {/* 消息内容 - 保留换行 */}
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
          {message.content || (isStreaming ? '' : '...')}
        </div>
        
        {/* 时间戳 */}
        <div 
          className={`
            text-xs mt-1 
            ${isUser ? 'text-blue-100' : 'text-gray-400'}
          `}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
      
      {/* 用户头像 */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium ml-3">
          U
        </div>
      )}
    </div>
  )
})

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default ChatBubble
