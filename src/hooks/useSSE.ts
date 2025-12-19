import { useCallback, useRef } from 'react'
import { API_CONFIG } from '../config'

// 卡片信息接口
export interface CardInfo {
  title: string
  desc: string
  image: string
}

// SSE 事件数据接口
interface SSEEventData {
  event: 'message' | 'message_end' | 'workflow_started' | string
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
 * 使用 XMLHttpRequest 处理 SSE 流式响应，与旧项目保持一致
 */
export function useSSE() {
  const xhrRef = useRef<XMLHttpRequest | null>(null)
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
    if (xhrRef.current) {
      xhrRef.current.abort()
    }

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', API_CONFIG.BASE_URL + 'chat-messages')
    xhr.setRequestHeader('Content-Type', 'application/json')

    let responseText = ''
    let jsonBuffer = ''
    const MAX_BUFFER_SIZE = 500000

    xhr.onprogress = () => {
      if (xhr.responseText) {
        const newText = xhr.responseText
        const deltaText = newText.slice(responseText.length)
        responseText = newText

        const parts = deltaText.split('data: ').filter(part => part.trim())

        parts.forEach(part => {
          try {
            const combinedText = jsonBuffer + part
            const data: SSEEventData = JSON.parse(combinedText)
            jsonBuffer = ''

            switch (data.event) {
              case 'message':
                if (data.content !== undefined) {
                  onDelta(data.content)
                }
                break
              case 'message_end':
                if (data.conversation_id) {
                  conversationIdRef.current = data.conversation_id
                }
                if (data.message_id) {
                  messageIdRef.current = data.message_id
                }
                const cardInfo = data.card_info ? 
                  (Array.isArray(data.card_info) ? data.card_info : [data.card_info]) : 
                  undefined
                onDone(cardInfo)
                break
              case 'workflow_started':
                if (data.task_id) {
                  taskIdRef.current = data.task_id
                }
                break
            }
          } catch {
            jsonBuffer += part
            if (jsonBuffer.length > MAX_BUFFER_SIZE) {
              console.warn('JSON缓冲区过大，已清空')
              jsonBuffer = ''
            }
          }
        })
      }
    }

    xhr.onerror = () => {
      onError(new Error('网络请求错误'))
    }

    xhr.onabort = () => {
      console.log('请求已中止')
    }

    const requestData = {
      app_id: API_CONFIG.APP_ID,
      inputs: {},
      query: message,
      response_mode: 'streaming',
      user: userRef.current,
      conversation_id: conversationIdRef.current,
    }

    xhr.send(JSON.stringify(requestData))
  }, [])

  // 停止AI响应
  const stopResponse = useCallback(async () => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
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
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
    }
  }, [])

  // 中止请求
  const abort = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort()
      xhrRef.current = null
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
