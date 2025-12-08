import { useRef, useCallback, useEffect } from 'react'

/**
 * 自动滚动 Hook
 * 使用 requestAnimationFrame 节流，避免频繁触发滚动
 */
export function useAutoScroll(dependency) {
  const containerRef = useRef(null)
  const rafRef = useRef(null)
  const isUserScrollingRef = useRef(false)
  const lastScrollTopRef = useRef(0)

  // 检测用户是否在手动滚动
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    
    // 如果用户向上滚动，暂停自动滚动
    if (scrollTop < lastScrollTopRef.current && !isAtBottom) {
      isUserScrollingRef.current = true
    }
    
    // 如果用户滚动到底部，恢复自动滚动
    if (isAtBottom) {
      isUserScrollingRef.current = false
    }
    
    lastScrollTopRef.current = scrollTop
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    if (isUserScrollingRef.current) return
    
    // 使用 RAF 节流
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        })
      }
    })
  }, [])

  // 依赖变化时自动滚动
  useEffect(() => {
    scrollToBottom(false)
  }, [dependency, scrollToBottom])

  // 清理
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return { containerRef, handleScroll, scrollToBottom }
}
