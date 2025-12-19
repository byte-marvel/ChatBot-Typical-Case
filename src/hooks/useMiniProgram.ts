import { useCallback, useEffect, useRef, useState } from 'react'

// 从 URL 获取参数
function getUrlParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}

// 生成 sessionId（如果 URL 中没有）
function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// 检测是否在微信小程序 web-view 中
function isInMiniProgram(): boolean {
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('miniprogram') || ua.includes('wechatdevtools')
}

// 轮询服务器 API 地址
const POLL_API_URL = '/api/poll'

interface LocationInfo {
  latitude: number | null
  longitude: number | null
}

interface PollResult {
  type: 'voice' | 'image'
  data: string
}

/**
 * 小程序交互 Hook
 * 提供 sessionId、位置信息、轮询和 postMessage 功能
 */
export function useMiniProgram() {
  const [sessionId] = useState<string>(() => {
    return getUrlParam('sessionId') || generateSessionId()
  })
  
  const [location] = useState<LocationInfo>(() => ({
    latitude: parseFloat(getUrlParam('latitude') || '') || null,
    longitude: parseFloat(getUrlParam('longitude') || '') || null,
  }))
  
  const [isInMP] = useState<boolean>(isInMiniProgram)
  const pollIntervalRef = useRef<number | null>(null)
  const onVoiceResultRef = useRef<((text: string) => void) | null>(null)
  const onImageResultRef = useRef<((imageUrl: string) => void) | null>(null)

  // 功能1: 通过 postMessage 触发小程序跳转到其他小程序
  const navigateToMiniProgram = useCallback((appId: string, path?: string, extraData?: object) => {
    if (!isInMP) {
      console.warn('Not in mini program environment')
      return
    }
    
    // 微信小程序 web-view 的 postMessage
    if ((window as any).wx?.miniProgram?.postMessage) {
      (window as any).wx.miniProgram.postMessage({
        data: {
          type: 'navigateToMiniProgram',
          appId,
          path,
          extraData,
        }
      })
      
      // postMessage 只有在特定时机才会触发，需要配合 navigateBack
      // 如果需要立即触发，可以调用 navigateBack
      (window as any).wx.miniProgram.navigateBack()
    }
  }, [isInMP])

  // 功能2: 通过链接跳转，支持 short link 和 schema URL 两种格式
  // short link: #小程序://大众点评丨美食团购外卖酒店电影/GCqwbsf3nFrx6nn
  // schema URL: weixin://dl/business/?appid=wxa75efa648b60994b&path=pages/index/index
  const openLink = useCallback((link: string) => {
    if (!isInMP) {
      console.warn('Not in mini program environment, link:', link)
      return
    }

    // 判断链接类型
    const isShortLink = link.includes('#小程序://') || link.includes('小程序://')
    const isSchemaUrl = link.startsWith('weixin://dl/business/')

    if ((window as any).wx?.miniProgram?.postMessage) {
      if (isShortLink) {
        // short link 格式
        (window as any).wx.miniProgram.postMessage({
          data: {
            type: 'openShortLink',
            shortLink: link,
          }
        })
      } else if (isSchemaUrl) {
        // schema URL 格式，解析出 appid 和 path
        const schemaUrlObj = new URL(link)
        const msgData = {
          type: 'openSchemaUrl',
          schemaUrl: link,
          appid: schemaUrlObj.searchParams.get('appid') || '',
          path: schemaUrlObj.searchParams.get('path') || '',
        }
        
        ;(window as any).wx.miniProgram.postMessage({
          data: msgData
        })
      } else {
        // 未知格式，尝试作为普通链接处理
        (window as any).wx.miniProgram.postMessage({
          data: {
            type: 'openLink',
            link,
          }
        })
      }
      
      // postMessage 只有在特定时机才会触发，需要配合 navigateBack
      (window as any).wx.miniProgram.navigateBack()
    }
  }, [isInMP])

  // 控制小程序悬浮球显示/隐藏
  const setVoiceBtnVisible = useCallback((visible: boolean) => {
    if (!isInMP) return
    
    if ((window as any).wx?.miniProgram?.postMessage) {
      (window as any).wx.miniProgram.postMessage({
        data: {
          type: visible ? 'showVoiceBtn' : 'hideVoiceBtn'
        }
      })
    }
  }, [isInMP])

  const setCameraBtnVisible = useCallback((visible: boolean) => {
    if (!isInMP) return
    
    if ((window as any).wx?.miniProgram?.postMessage) {
      (window as any).wx.miniProgram.postMessage({
        data: {
          type: visible ? 'showCameraBtn' : 'hideCameraBtn'
        }
      })
    }
  }, [isInMP])

  // 通知小程序 H5 页面已加载完成
  const notifyReady = useCallback(() => {
    if (!isInMP) return
    
    if ((window as any).wx?.miniProgram?.postMessage) {
      (window as any).wx.miniProgram.postMessage({
        data: {
          type: 'webviewReady'
        }
      })
    }
  }, [isInMP])

  // 轮询服务器获取小程序发送的数据
  const poll = useCallback(async () => {
    try {
      const response = await fetch(`${POLL_API_URL}?sessionId=${sessionId}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const pollResult: PollResult = {
          type: result.type,
          data: result.data
        }
        
        if (pollResult.type === 'voice' && onVoiceResultRef.current) {
          onVoiceResultRef.current(pollResult.data)
        } else if (pollResult.type === 'image' && onImageResultRef.current) {
          onImageResultRef.current(pollResult.data)
        }
      }
    } catch (error) {
      console.error('Poll error:', error)
    }
  }, [sessionId])

  // 开始轮询
  const startPolling = useCallback((
    onVoiceResult?: (text: string) => void,
    onImageResult?: (imageUrl: string) => void,
    interval: number = 2000
  ) => {
    onVoiceResultRef.current = onVoiceResult || null
    onImageResultRef.current = onImageResult || null
    
    // 清除之前的轮询
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    
    // 立即执行一次
    poll()
    
    // 开始定时轮询
    pollIntervalRef.current = window.setInterval(poll, interval)
  }, [poll])

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    onVoiceResultRef.current = null
    onImageResultRef.current = null
  }, [])

  // 组件卸载时停止轮询
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    sessionId,
    location,
    isInMiniProgram: isInMP,
    navigateToMiniProgram,
    openLink,
    setVoiceBtnVisible,
    setCameraBtnVisible,
    notifyReady,
    startPolling,
    stopPolling,
  }
}
