import { memo } from 'react'
import ChatBubble from './ChatBubble'

/**
 * 消息列表组件
 * 使用 memo 优化，配合 key 让 React 高效 diff
 */
const MessageList = memo(function MessageList({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-4">💬</div>
          <div className="text-lg font-medium">开始对话</div>
          <div className="text-sm mt-1">发送一条消息开始聊天</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full px-4 py-6 max-w-4xl mx-auto">
        {messages.map((message) => (
          <ChatBubble 
            key={message.id} 
            message={message} 
          />
        ))}
      </div>
    </div>
  )
})

export default MessageList
