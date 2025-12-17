import { useCallback, useRef } from 'react'

// SSE 接口配置
const SSE_API_URL = '/api/chat'

/**
 * SSE 流式请求 Hook
 * 使用 fetch + ReadableStream 处理 SSE，比 EventSource 更灵活
 */
export function useSSE() {
  const abortControllerRef = useRef(null)
  const conversationIdRef = useRef(null)

  const sendMessage = useCallback(async (message, onDelta, onDone, onError) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    try {
      const response = await fetch(SSE_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          uid: 'tdesign-chat',
          prompt: message,
          think: false,
          search: false,
          user: 'demo@example.com',
          query: message,
          conversation_id: conversationIdRef.current,
        }),
        signal: abortControllerRef.current.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      console.log('[SSE] Stream started')
      
      // 解析单行 SSE 数据的辅助函数
      const parseLine = (line) => {
        console.log('[SSE] Parsing line:', line)
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            console.log('[SSE] Parsed data:', data)
            
            // 保存 conversation_id 用于后续对话
            if (data.conversation_id) {
              conversationIdRef.current = data.conversation_id
            }
            
            if (data.type === 'delta' && data.content) {
              console.log('[SSE] Delta:', data.content)
              onDelta(data.content)
            } else if (data.type === 'done') {
              console.log('[SSE] Done received')
              onDone()
            }
          } catch (e) {
            console.warn('SSE parse error:', e, 'line:', line)
          }
        }
      }
      
      while (true) {
        const { done, value } = await reader.read()
        console.log('[SSE] Read chunk, done:', done, 'value length:', value?.length)
        
        if (done) {
          console.log('[SSE] Stream ended, remaining buffer:', buffer)
          // 流结束时，处理 buffer 中剩余的数据
          if (buffer.trim()) {
            parseLine(buffer)
          }
          onDone() // 确保流结束时调用 onDone
          break
        }
        
        const chunk = decoder.decode(value, { stream: true })
        console.log('[SSE] Decoded chunk:', chunk)
        buffer += chunk
        
        // 解析 SSE 数据行
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行
        console.log('[SSE] Lines to parse:', lines.length, 'remaining buffer:', buffer)
        
        for (const line of lines) {
          parseLine(line)
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
