import { useState, useCallback, memo } from 'react'

/**
 * 聊天输入框组件
 */
const ChatInput = memo(function ChatInput({ onSend, disabled }) {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setInput('')
    }
  }, [input, disabled, onSend])

  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e)
    }
  }, [handleSubmit])

  return (
    <form 
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-white p-4"
    >
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Ctrl+Enter 发送)"
            disabled={disabled}
            rows={1}
            className="
              w-full resize-none rounded-xl border border-gray-300 
              px-4 py-3 pr-12
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 disabled:cursor-not-allowed
              text-[15px] leading-relaxed
              max-h-32
            "
            style={{ 
              minHeight: '48px',
              height: 'auto'
            }}
            onInput={(e) => {
              // 自动调整高度
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
            }}
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="
            flex-shrink-0 w-12 h-12 rounded-xl
            bg-blue-500 hover:bg-blue-600 
            disabled:bg-gray-300 disabled:cursor-not-allowed
            text-white font-medium
            transition-colors duration-150
            flex items-center justify-center
          "
        >
          {disabled ? (
            // 加载动画
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" cy="12" r="10" 
                stroke="currentColor" 
                strokeWidth="4"
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            // 发送图标
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
              />
            </svg>
          )}
        </button>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-2">
        演示项目 · SSE 流式响应
      </div>
    </form>
  )
})

export default ChatInput
