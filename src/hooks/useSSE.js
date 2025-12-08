import { useCallback, useRef } from 'react'

/**
 * SSE 流式请求 Hook
 * 使用 fetch + ReadableStream 处理 SSE，比 EventSource 更灵活
 */
export function useSSE() {
  const abortControllerRef = useRef(null)

  const sendMessage = useCallback(async (message, onDelta, onDone, onError) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: abortControllerRef.current.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        
        // 解析 SSE 数据行
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'delta') {
                onDelta(data.content)
              } else if (data.type === 'done') {
                onDone()
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        onError(error)
      }
    }
  }, [])

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return { sendMessage, abort }
}
