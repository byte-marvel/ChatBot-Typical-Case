import { useCallback, useRef } from 'react'
import { API_CONFIG } from '../config'

// 卡片信息接口
export interface CardInfo {
  title: string
  desc: string
  image: string
}

// SSE 事件数据接口
interface SSEData {
  event?: 'message' | 'message_end' | 'workflow_started' | string
  type?: 'delta' | 'done'
  content?: string
  conversation_id?: string
  message_id?: string
  task_id?: string
  card_info?: CardInfo[]
}

// 推荐问题响应接口
interface SuggestedQuestionsResponse {
  result: boolean
  data: string[]
}

// 首页推荐问题响应接口
export interface IndexQuestionsResponse {
  result: boolean
  data: {
    card_questions: { question: string; image: string }[]
    flowing_questions: string[]
  }
}

/**
 * SSE 流式请求 Hook
 * 使用 fetch + ReadableStream 处理 SSE，比 EventSource 更灵活
 */
export function useSSE() {
  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const messageIdRef = useRef<string | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const userRef = useRef<string>('Anonymous')

  // 设置用户ID
  const setUser = useCallback((userId: string) => {
    userRef.current = userId || 'Anonymous'
  }, [])

  // 发送消息
  const sendMessage = useCallback(async (
    message: string,
    onDelta: (content: string) => void,
    onDone: (cardInfo?: CardInfo[]) => void,
    onError: (error: Error) => void
  ) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    abortControllerRef.current = new AbortController()
    
    try {
      const response = await fetch(API_CONFIG.BASE_URL + 'chat-messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          app_id: API_CONFIG.APP_ID,
          inputs: {},
          query: message,
          response_mode: 'streaming',
          user: userRef.current,
          conversation_id: conversationIdRef.current,
        }),
        signal: abortControllerRef.current.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let cardInfo: CardInfo[] | undefined
      
      console.log('[SSE] Stream started')
      
      // 解析单行 SSE 数据的辅助函数
      const parseLine = (line: string) => {
        console.log('[SSE] Parsing line:', line)
        if (line.startsWith('data: ')) {
          try {
            const data: SSEData = JSON.parse(line.slice(6))
            console.log('[SSE] Parsed data:', data)
            
            // 保存 conversation_id 用于后续对话
            if (data.conversation_id) {
              conversationIdRef.current = data.conversation_id
            }
            if (data.message_id) {
              messageIdRef.current = data.message_id
            }
            if (data.task_id) {
              taskIdRef.current = data.task_id
            }
            
            // 兼容两种格式：event 或 type
            const eventType = data.event || data.type
            
            if ((eventType === 'message' || eventType === 'delta') && data.content) {
              console.log('[SSE] Delta:', data.content)
              onDelta(data.content)
            } else if (eventType === 'message_end' || eventType === 'done') {
              console.log('[SSE] Done received')
              if (data.card_info) {
                cardInfo = Array.isArray(data.card_info) ? data.card_info : [data.card_info]
              }
            } else if (eventType === 'workflow_started') {
              console.log('[SSE] Workflow started')
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
          onDone(cardInfo) // 确保流结束时调用 onDone
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
      if (error instanceof Error && error.name !== 'AbortError') {
        onError(error)
      }
    }
  }, [])

  // 停止AI响应
  const stopResponse = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (taskIdRef.current) {
      try {
        await fetch(API_CONFIG.BASE_URL + 'chat-messages-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: API_CONFIG.APP_ID,
            user: userRef.current,
            task_id: taskIdRef.current,
          }),
        })
      } catch (error) {
        console.error('停止API调用失败:', error)
      }
    }
  }, [])

  // 获取推荐问题
  const fetchSuggestedQuestions = useCallback(async (): Promise<string[]> => {
    if (!conversationIdRef.current || !messageIdRef.current) {
      return []
    }

    try {
      const response = await fetch(API_CONFIG.BASE_URL + 'suggested', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: API_CONFIG.APP_ID,
          conversation_id: conversationIdRef.current,
          message_id: messageIdRef.current,
          user: userRef.current,
        }),
      })
      const data: SuggestedQuestionsResponse = await response.json()
      if (data.result && data.data) {
        return data.data
      }
    } catch (error) {
      console.error('获取推荐问题失败:', error)
    }
    return []
  }, [])

  // 获取首页推荐问题
  const fetchIndexQuestions = useCallback(async (): Promise<IndexQuestionsResponse['data'] | null> => {
    try {
      const response = await fetch(API_CONFIG.BASE_URL + 'index_questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: API_CONFIG.APP_ID,
        }),
      })
      const data: IndexQuestionsResponse = await response.json()
      if (data.result && data.data) {
        return data.data
      }
    } catch (error) {
      console.error('获取首页推荐问题失败:', error)
    }
    return null
  }, [])

  // 清空会话
  const clearConversation = useCallback(() => {
    conversationIdRef.current = null
    messageIdRef.current = null
    taskIdRef.current = null
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // 中止请求
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return { 
    sendMessage, 
    stopResponse,
    fetchSuggestedQuestions,
    fetchIndexQuestions,
    clearConversation,
    setUser,
    abort 
  }
}
