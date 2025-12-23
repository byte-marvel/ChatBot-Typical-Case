import { useState, useCallback, useRef, useEffect } from 'react'
import { Bubble, Sender, XProvider, Actions } from '@ant-design/x'
import type { ThoughtChainItemType } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import robotAvatar from './assets/robot-avatar.png'
import robotAvatarDynamic from './assets/robot-avatar-dynamic.gif'
import iconNew from './assets/icon_new.png'
import bgWelcome from './assets/img_bg.jpg'
import welcomeBanner from './assets/welcome.png'
import robotGif from './assets/robot.gif'
import robotPng from './assets/robot.png'
import bgChat from './assets/img_bg_chat.png'
import ArrowDownOutlined from '@ant-design/icons/ArrowDownOutlined'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import { ConfigProvider, theme, Avatar, Tag, message, Modal, Image, Skeleton, Card } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useSSE, CardInfo } from './hooks/useSSE'
import { useMiniProgram } from './hooks/useMiniProgram'
import { API_CONFIG } from './config'

// 消息类型定义
interface Message {
  key: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  isWelcome?: boolean
  isStop?: boolean
  isCompleted?: boolean
  cardInfo?: CardInfo[]
}

// 卡片问题类型
interface CardQuestion {
  question: string
  image: string
}

// 生成唯一 ID
let messageId = 0
const genId = () => `msg_${++messageId}_${Date.now()}`

// 图片占位符组件
const ImagePlaceholder = () => (
  <div style={{ 
    display: 'inline-block', 
    verticalAlign: 'middle',
    margin: '8px 0',
  }}>
    <Skeleton.Image active style={{ width: 340, height: 195 }} />
  </div>
)

// 处理流式渲染中的不完整 markdown 语法（如图片链接）
// 返回处理后的内容和是否有未完成图片的标记
const processStreamingMarkdown = (content: string, isCompleted: boolean): { text: string; hasIncompleteImage: boolean } => {
  if (isCompleted) return { text: content, hasIncompleteImage: false }
  
  // 完整的图片语法: ![alt](url)
  const completeImageRegex = /!\[[^\]]*\]\([^)]+\)/g
  
  // 不完整的图片语法（必须以 ![ 开头才算图片语法开始）:
  // - ![...]( 后面 URL 未闭合: !\[[^\]]*\]\([^)]*$
  // - ![ 后面 alt 未闭合: !\[[^\]]*$
  // 注意：不再匹配单独的 !，避免普通感叹号被误判
  const incompleteImageRegex = /!\[[^\]]*\]\([^)]*$|!\[[^\]]*$/g
  
  // 检测是否有未完成的图片语法
  const hasIncompleteImage = incompleteImageRegex.test(content)
  
  // 重置正则（因为 test 会改变 lastIndex）
  incompleteImageRegex.lastIndex = 0
  
  // 先保护完整的图片语法
  const completeImages: string[] = []
  let processed = content.replace(completeImageRegex, (match) => {
    completeImages.push(match)
    return `__COMPLETE_IMAGE_${completeImages.length - 1}__`
  })
  
  // 移除不完整的图片语法
  processed = processed.replace(incompleteImageRegex, '')
  
  // 恢复完整的图片语法
  completeImages.forEach((img, index) => {
    processed = processed.replace(`__COMPLETE_IMAGE_${index}__`, img)
  })
  
  return { text: processed, hasIncompleteImage }
}

// 获取思考状态图标
function getThinkingStatusIcon(status: ThoughtChainItemType['status']) {
  switch (status) {
    case 'success':
      return <CheckCircleOutlined />
    case 'loading':
      return <LoadingOutlined />
    default:
      return undefined
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [cardQuestions, setCardQuestions] = useState<CardQuestion[]>([])
  const [flowingQuestions, setFlowingQuestions] = useState<string[]>([])
  const [thinkingItems, setThinkingItems] = useState<ThoughtChainItemType[]>([])
  const [showCardModal, setShowCardModal] = useState(false)
  const [currentCard, setCurrentCard] = useState<CardInfo | null>(null)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  
  const { 
    sendMessage, 
    stopResponse, 
    fetchSuggestedQuestions, 
    fetchIndexQuestions,
    clearConversation,
    abort,
  } = useSSE()
  
  // 小程序交互 Hook
  const { 
    sessionId, 
    isInMiniProgram, 
    openLink,
    notifyReady,
    startPolling,
    stopPolling 
  } = useMiniProgram()

  // 测试链接
  const TEST_SHORT_LINK = '#小程序://大众点评丨美食团购外卖酒店电影/GCqwbsf3nFrx6nn'
  const TEST_SCHEMA_URL = 'weixin://dl/business/?appid=wxa735b18c5812d986&path=pages%2Findex%2Findex%3Fcontext%3Dgd%26page%3DgiftcardHome'
  
  // 当前正在流式更新的消息 ID
  const streamingIdRef = useRef<string | null>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const hasReceivedFirstResponseRef = useRef<boolean>(false)
  
  // 处理语音识别结果
  const handleVoiceResult = useCallback((text: string) => {
    console.log('收到语音识别结果:', text)
    message.success('语音识别成功')
    setInputValue(prev => prev + text)
  }, [])
  
  // 处理图片上传结果
  const handleImageResult = useCallback((imageUrl: string) => {
    console.log('收到图片上传结果:', imageUrl)
    message.success('图片上传成功')
    setInputValue(prev => prev + `[图片: ${imageUrl}]`)
  }, [])

  // 获取首页推荐问题
  useEffect(() => {
    const loadIndexQuestions = async () => {
      const data = await fetchIndexQuestions()
      if (data) {
        setCardQuestions(data.card_questions || [])
        setFlowingQuestions(data.flowing_questions || [])
      } else {
        // 设置默认数据
        setCardQuestions([
        ])
        setFlowingQuestions([
        ])
      }
    }
    loadIndexQuestions()
  }, [fetchIndexQuestions])
  
  // 在小程序环境中启动轮询
  useEffect(() => {
    if (isInMiniProgram) {
      console.log('在小程序环境中，启动轮询, sessionId:', sessionId)
      startPolling(handleVoiceResult, handleImageResult, 2000)
      notifyReady()
      
      return () => {
        stopPolling()
      }
    }
  }, [isInMiniProgram, sessionId, startPolling, stopPolling, handleVoiceResult, handleImageResult, notifyReady])

  // 更新流式消息内容
  const appendContent = useCallback((content: string) => {
    // 第一次收到响应时，添加第三步：思考完成（步骤1、2完成，步骤3直接完成）
    if (!hasReceivedFirstResponseRef.current) {
      hasReceivedFirstResponseRef.current = true
      setThinkingItems([
        {
          title: `${API_CONFIG.ROBOT_NAME}开始思考~`,
          status: 'success',
          icon: getThinkingStatusIcon('success'),
        },
        {
          title: '数据加载 ing，马上就好～',
          status: 'success',
          icon: getThinkingStatusIcon('success'),
        },
        {
          title: `${API_CONFIG.ROBOT_NAME}思考完成~`,
          status: 'success',
          icon: getThinkingStatusIcon('success'),
        },
      ])
    }
    
    setMessages(prev => prev.map(msg => 
      msg.key === streamingIdRef.current
        ? { ...msg, content: msg.content + content, loading: false }
        : msg
    ))
  }, [])

  // 完成流式消息
  const finishStreaming = useCallback(async (cardInfo?: CardInfo[]) => {
    setMessages(prev => prev.map(msg =>
      msg.key === streamingIdRef.current
        ? { ...msg, loading: false, isCompleted: true, cardInfo }
        : msg
    ))
    streamingIdRef.current = null
    setIsLoading(false)
    hasReceivedFirstResponseRef.current = false
    
    // 获取推荐问题
    const questions = await fetchSuggestedQuestions()
    setSuggestedQuestions(questions)
  }, [fetchSuggestedQuestions])

  // 发送消息
  const handleSend = useCallback((content: string) => {
    if (!content.trim() || isLoading) return
    
    // 隐藏欢迎页
    setShowWelcome(false)
    // 清空推荐问题
    setSuggestedQuestions([])
    
    // 重置第一次响应标记
    hasReceivedFirstResponseRef.current = false
    
    // 步骤1: 开始思考 (loading状态)
    setThinkingItems([
      {
        title: `${API_CONFIG.ROBOT_NAME}开始思考~`,
        status: 'loading',
        icon: getThinkingStatusIcon('loading'),
      },
    ])
    
    // 添加用户消息
    const userMessage: Message = {
      key: genId(),
      role: 'user',
      content,
    }
    
    // 创建 AI 消息占位
    const aiMessage: Message = {
      key: genId(),
      role: 'assistant',
      content: '',
      loading: true,
    }
    
    streamingIdRef.current = aiMessage.key
    setMessages(prev => [...prev, userMessage, aiMessage])
    setIsLoading(true)
    setInputValue('')
    setIsScrolledToBottom(true)
    
    // 延迟1秒后切换到步骤2: 数据加载状态
    setTimeout(() => {
      setThinkingItems([
        {
          title: `${API_CONFIG.ROBOT_NAME}开始思考~`,
          status: 'success',
          icon: getThinkingStatusIcon('success'),
        },
        {
          title: '数据加载 ing，马上就好～',
          status: 'loading',
          icon: getThinkingStatusIcon('loading'),
        },
      ])
    }, 1000)
    
    // 发送 SSE 请求
    sendMessage(
      content,
      (delta) => appendContent(delta),
      (cardInfo) => finishStreaming(cardInfo),
      (error) => {
        console.error('SSE Error:', error)
        setMessages(prev => prev.map(msg =>
          msg.key === streamingIdRef.current
            ? { ...msg, content: '抱歉，暂时无法连接到AI服务，请稍后再试。', loading: false }
            : msg
        ))
        streamingIdRef.current = null
        setIsLoading(false)
        setThinkingItems([])
      }
    )
  }, [sendMessage, appendContent, finishStreaming, isLoading])

  // 停止AI响应
  const handleStop = useCallback(async () => {
    await stopResponse()
    setIsLoading(false)
    setThinkingItems([])
    
    // 添加停止消息
    const stopMessage: Message = {
      key: genId(),
      role: 'assistant',
      content: `${API_CONFIG.ROBOT_NAME}已为您停止输出`,
      isStop: true,
    }
    setMessages(prev => [...prev, stopMessage])
    streamingIdRef.current = null
  }, [stopResponse])

  // 新建对话
  const handleNewChat = useCallback(() => {
    Modal.confirm({
      title: '确认新建对话',
      content: '新建对话将清空当前所有聊天记录，是否继续？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        clearConversation()
        setMessages([])
        setSuggestedQuestions([])
        setShowWelcome(true)
        setIsLoading(false)
        setInputValue('')
        setThinkingItems([])
      },
    })
  }, [clearConversation])

  // 发送示例问题
  const sendExample = useCallback((text: string) => {
    setInputValue(text)
    handleSend(text)
  }, [handleSend])

  // 打开卡片详情
  const openCardModal = useCallback((card: CardInfo) => {
    setCurrentCard(card)
    setShowCardModal(true)
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
    setIsScrolledToBottom(true)
  }, [])

  // 上一次的 scrollTop，用于检测用户是否主动向上滚动
  const lastScrollTopRef = useRef(0)

  // 检查滚动位置 - 只有用户主动向上滚动时才停止自动滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const { scrollTop, scrollHeight, clientHeight } = target
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    const isBottom = distanceToBottom < 100
    
    // 检测用户是否主动向上滚动（scrollTop 减小）
    const isUserScrollingUp = scrollTop < lastScrollTopRef.current - 10
    
    // console.log('[Scroll Debug]', { scrollTop, scrollHeight, clientHeight, distanceToBottom, isBottom, isUserScrollingUp, lastScrollTop: lastScrollTopRef.current })
    
    if (isUserScrollingUp && !isBottom) {
      // 用户主动向上滚动，停止自动滚动
      setIsScrolledToBottom(false)
    } else if (isBottom) {
      // 滚动到底部，恢复自动滚动
      setIsScrolledToBottom(true)
    }
    // 其他情况（如内容高度增加导致的被动滚动）保持原状态不变
    
    lastScrollTopRef.current = scrollTop
  }, [])

  // 消息更新时自动滚动到底部
  useEffect(() => {
    if (isScrolledToBottom && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages, isScrolledToBottom])

  // 推荐问题加载完成后滚动到底部
  useEffect(() => {
    if (suggestedQuestions.length > 0 && isScrolledToBottom && messageListRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 渲染完成后再滚动
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight
        }
      })
    }
  }, [suggestedQuestions, isScrolledToBottom])

  // 角色配置
  const roles = {
    user: {
      placement: 'end' as const,
    },
    assistant: {
      placement: 'start' as const,
      header: (
        <Avatar 
          src={isLoading ? robotAvatarDynamic : robotAvatar}
          size={60}
          style={{ marginBottom: -25, zIndex: 1 }} 
        />
      ),
    },
  }

  // 获取当前思考状态文本（只显示最新状态）
  const getCurrentThinkingStatus = () => {
    if (thinkingItems.length === 0) return ''
    const lastItem = thinkingItems[thinkingItems.length - 1]
    return lastItem.title
  }

  // 渲染消息内容
  const renderMessageContent = (msg: Message) => {
    if (msg.loading) {
      const currentStatus = getCurrentThinkingStatus()
      const isLoading = thinkingItems.length > 0 && thinkingItems[thinkingItems.length - 1].status === 'loading'
      return (
        <div style={{ padding: '8px 0' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            color: '#666',
            fontSize: 14,
          }}>
            {isLoading ? <LoadingOutlined style={{ color: '#1890ff' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
            <span>{currentStatus || '思考中...'}</span>
          </div>
        </div>
      )
    }
    
    return (
      <div>
        {msg.role === 'assistant' && !msg.isWelcome && !msg.isStop && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              color: '#666',
              fontSize: 14,
            }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>{`${API_CONFIG.ROBOT_NAME}思考完成~ `}</span>
            </div>
          </div>
        )}
        {(() => {
          const { text, hasIncompleteImage } = processStreamingMarkdown(msg.content, !!msg.isCompleted)
          return (
            <>
              <XMarkdown>{text}</XMarkdown>
              {hasIncompleteImage && <ImagePlaceholder />}
            </>
          )
        })()}
        
      </div>
    )
  }

  // 渲染卡片列表（用于 Bubble footer）
  const renderCardList = (cardInfo: CardInfo[]) => {
    if (!cardInfo || cardInfo.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {cardInfo.map((card, index) => (
          <Card
            key={index}
            hoverable
            onClick={() => openCardModal(card)}
            styles={{
              body: { padding: 0 },
            }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex' }}>
              <div style={{ width: 120, height: 90, flexShrink: 0 }}>
                <img
                  src={card.image}
                  alt={card.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#333', marginBottom: 8 }}>
                  {card.title}
                </div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {card.desc}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // 渲染 Bubble footer（包含卡片列表和复制按钮）
  const renderBubbleFooter = (msg: Message) => {
    if (msg.role !== 'assistant') return undefined
    
    const hasCards = msg.cardInfo && msg.cardInfo.length > 0
    const showCopyButton = msg.isCompleted && msg.content
    
    if (!hasCards && !showCopyButton) return undefined
    
    return (
      <div style={{ width: '100%' }}>
        {hasCards && renderCardList(msg.cardInfo!)}
        {showCopyButton && (
          <div style={{ marginTop: hasCards ? 12 : 0, display: 'flex', justifyContent: 'flex-end' }}>
            <Actions.Copy text={msg.content} style={{ fontSize: 18 }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <XProvider>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: { colorPrimary: '#ff7d00', borderRadius: 8 },
        }}
      >
        <div style={{ 
          height: '100%', 
          width: '100%',
          display: 'flex', 
          flexDirection: 'column',
          background: '#F5F7FA',
          backgroundImage: `url(${showWelcome ? bgWelcome : bgChat})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}>
          {/* 头部 - 仅在聊天界面显示 */}
          {!showWelcome && (
            <header style={{
              padding: '0 16px',
              height: 44,
              background: '#fff',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 返回按钮 */}
                <div 
                  onClick={() => {
                    // 中断当前SSE请求并清理状态（与新建对话相同）
                    abort()
                    clearConversation()
                    setMessages([])
                    setSuggestedQuestions([])
                    setShowWelcome(true)
                    setIsLoading(false)
                    setInputValue('')
                    setThinkingItems([])
                  }}
                  style={{ 
                    cursor: 'pointer', 
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="#333"/>
                  </svg>
                </div>
                {/* 标题 */}
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#333' }}>{API_CONFIG.ROBOT_NAME}</h1>
              </div>
              
              {/* 新建对话按钮 */}
              <div 
                onClick={handleNewChat}
                style={{ 
                  cursor: 'pointer', 
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <img src={iconNew} alt="新建对话" style={{ width: 25, height: 25 }} />
              </div>
            </header>
          )}
          
          {/* 消息区域 */}
          <main style={{ 
            flex: 1, 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {showWelcome ? (
              // 欢迎页
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                padding: '0 10px',
                overflow: 'auto',
              }}>
                {/* 欢迎横幅图片 */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  marginTop: 40,
                }}>
                  <img 
                    src={welcomeBanner} 
                    alt="welcome" 
                    style={{ height: 100 }} 
                  />
                </div>
                
                {/* 机器人头像 */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                }}>
                  <img 
                    src={robotGif} 
                    alt="robot" 
                    style={{ width: 200, height: 265 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = robotPng }}
                  />
                </div>
                
                {/* 提示文字 */}
                <div style={{ 
                  fontSize: 16, 
                  color: '#351C1C', 
                  marginBottom: 10, 
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'left',
                  paddingLeft: 10,
                }}>
                  你可以这样对我说:
                </div>
                
                {/* 卡片式推荐问题 - 三列布局 */}
                <div style={{ 
                  display: 'flex', 
                  gap: 12, 
                  width: '100%', 
                  padding: '0 10px', 
                  boxSizing: 'border-box',
                  marginBottom: 24,
                }}>
                  {cardQuestions.map((item, index) => (
                    <div 
                      key={index}
                      onClick={() => sendExample(item.question)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        padding: '8px 5px 12px 5px',
                        background: '#fff',
                        borderRadius: 8,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <div 
                        style={{ 
                          width: 40, 
                          height: 40, 
                          marginBottom: 6,
                          backgroundImage: `url(${item.image})`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                        }} 
                      />
                      <span style={{ 
                        fontSize: 14, 
                        color: '#666', 
                        textAlign: 'center', 
                        lineHeight: 1.1,
                        wordBreak: 'break-word',
                        fontWeight: 400,
                      }}>
                        {item.question}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* 滚动式推荐问题 - 第一行 */}
                {(() => {
                  const midPoint = Math.ceil(flowingQuestions.length / 2);
                  const firstRow = flowingQuestions.slice(0, midPoint);
                  const secondRow = flowingQuestions.slice(midPoint);
                  return (
                    <>
                <div style={{ width: '100%', overflow: 'hidden', marginBottom: 8 }}>
                  <div className="marquee-content">
                    {[...firstRow, ...firstRow].map((question, index) => (
                      <span 
                        key={index}
                        onClick={() => sendExample(question)}
                        style={{
                          display: 'inline-block',
                          padding: '5px 10px',
                          background: '#fff',
                          borderRadius: 18,
                          margin: 10,
                          fontSize: 14,
                          color: '#666',
                          lineHeight: 1.4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        {question}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* 滚动式推荐问题 - 第二行 */}
                {secondRow.length > 0 && (
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <div className="marquee-content">
                      {[...secondRow, ...secondRow].map((question, index) => (
                        <span 
                          key={index}
                          onClick={() => sendExample(question)}
                          style={{
                            display: 'inline-block',
                            padding: '5px 10px',
                            background: '#fff',
                            borderRadius: 18,
                            margin: 10,
                            fontSize: 14,
                            color: '#666',
                            lineHeight: 1.4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {question}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                    </>
                  );
                })()}
              </div>
            ) : (
              // 聊天界面
              <div 
                ref={messageListRef}
                onScroll={handleScroll}
                style={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  padding: '2px',
                }}
              >
                <div style={{ width: '100%' }}>
                  <Bubble.List
                    items={messages.map(msg => ({
                      key: msg.key,
                      role: msg.role,
                      ...roles[msg.role],
                      content: renderMessageContent(msg),
                      // footer 包含卡片列表和复制按钮
                      footer: renderBubbleFooter(msg),
                      footerPlacement: 'inner-start',
                      styles: {
                        content: { fontSize: 15 }
                      }
                    }))}
                    style={{ background: 'transparent' }}
                  />
                  
                  {/* 推荐问题清单 */}
                  {suggestedQuestions.length > 0 && (
                    <div style={{ marginTop: -15, padding: '12px 16px', background: '#fff', borderRadius: 8 }}>
                      <div style={{ fontSize: 14, color: '#333', marginBottom: 8 , fontWeight: 500 }}>推荐问题：</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {suggestedQuestions.map((question, index) => (
                          <Card 
                            key={index}
                            size="small"
                            hoverable
                            style={{ cursor: 'pointer', width: 'fit-content', fontSize: 14 , border: '1px solid #ccc' , color: '#333' }}
                            styles={{ body: { padding: '6px 8px' }}}
                            onClick={() => sendExample(question)}
                          >
                            {question}
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 回到底部按钮 */}
            {!showWelcome && !isScrolledToBottom && (
              <div 
                onClick={scrollToBottom}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ArrowDownOutlined />
              </div>
            )}
          </main>
          
          {/* 输入区域 */}
          <footer style={{
            padding: '12px 16px',
            background: '#fff',
            borderTop: '1px solid #e8e8e8',
            flexShrink: 0,
            zIndex: 1071,
          }}>
            <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
              <Sender
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSend}
                onCancel={handleStop}
                loading={isLoading}
                readOnly={isLoading}
                placeholder={`我是${API_CONFIG.ROBOT_NAME}，有什么能帮您的？`}
              />
              <div style={{ 
                textAlign: 'center', 
                fontSize: 12, 
                color: '#999', 
                marginTop: 8 
              }}>
                内容由AI生成
              </div>
            </div>
          </footer>
          
          {/* 测试链接（小程序环境中显示） */}
          {isInMiniProgram && (
            <div style={{ 
              position: 'fixed', 
              bottom: 100, 
              right: 16, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8 
            }}>
              <Tag 
                color="blue" 
                style={{ cursor: 'pointer' }}
                onClick={() => openLink(TEST_SHORT_LINK)}
              >
                Short Link
              </Tag>
              <Tag 
                color="purple" 
                style={{ cursor: 'pointer' }}
                onClick={() => openLink(TEST_SCHEMA_URL)}
              >
                Schema URL
              </Tag>
            </div>
          )}
        </div>
        
        {/* 卡片详情弹窗 */}
        <Modal
          open={showCardModal}
          onCancel={() => setShowCardModal(false)}
          footer={null}
          title={currentCard?.title}
          width={400}
          centered
          style={{ top: -60 }}
          styles={{
            body: { padding: '18px 16px',maxHeight: '80vh', overflowY: 'auto' },
          }}
        >
          {currentCard && (
            <div>
              <Image 
                src={currentCard.image} 
                alt={currentCard.title}
                style={{ width: '100%', borderRadius: 8 }}
              />
              <p style={{ marginTop: 12, fontSize: 14, color: '#333', lineHeight: 1.6 }}>{currentCard.desc}</p>
            </div>
          )}
        </Modal>
        
        {/* 动画样式 */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          
          @keyframes marquee-reverse {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          
          .marquee-content {
            display: inline-flex;
            animation: marquee 20s linear infinite;
          }
          
          .marquee-reverse {
            animation: marquee-reverse 20s linear infinite;
          }
          
          .loading-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff7d00;
            animation: loading-bounce 1.4s infinite ease-in-out both;
          }
          
          @keyframes loading-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          /* Markdown 图片固定宽高 */
          .ant-markdown img {
            width: 400px;
            height: 266px;
            object-fit: cover;
            border-radius: 8px;
          }
          
          /* 消息气泡宽度最大化 */
          .ant-bubble {
            max-width: 100% !important;
            padding-inline-start: 0 !important;
            padding-inline-end: 0 !important;
          }
          .ant-bubble-content {
            max-width: 100% !important;
          }
          .ant-bubble-content-inner {
            max-width: 100% !important;
          }
          
          /* 用户消息气泡颜色 - 匹配原项目 */
          .ant-bubble[class*="end"] .ant-bubble-content {
            background-color: #F0A955 !important;
            color: #161616 !important;
            border-radius: 16px 16px 4px 16px !important;
          }
          
          /* AI消息气泡颜色 - 匹配原项目 */
          .ant-bubble[class*="start"] .ant-bubble-content {
            background-color: #F5EEE4 !important;
            color: #161616 !important;
            border-radius: 16px 16px 16px 4px !important;
          }
        `}</style>
      </ConfigProvider>
    </XProvider>
  )
}

export default App
