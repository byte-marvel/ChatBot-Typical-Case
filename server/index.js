import http from 'http'
import { URL } from 'url'

const PORT = 3001

// 模拟 AI 回复内容
const mockResponses = [
  "你好！我是一个 AI 助手，很高兴为你服务。",
  "这是一个演示 SSE（Server-Sent Events）流式响应的示例项目。SSE 是一种服务器向客户端推送数据的技术，非常适合实现聊天机器人的打字机效果。",
  "在这个项目中，我们使用了 React 18 的并发特性，配合 useSyncExternalStore 来优化流式更新的性能。每个字符都会实时推送到前端，模拟真实的 AI 对话体验。",
  "关于性能优化，我们采用了以下策略：\n1. 使用 CSS transform 代替 top/left 进行动画\n2. 消息列表使用 key 优化 React 的 diff 算法\n3. 自动滚动使用 requestAnimationFrame 节流\n4. 输入框使用防抖处理",
]

function getRandomResponse() {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)]
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  
  // SSE 聊天接口
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    console.log('Matched /api/chat POST')
    let body = ''
    let interval = null
    
    req.on('data', chunk => { 
      console.log('Received data chunk:', chunk.toString())
      body += chunk 
    })
    
    req.on('end', () => {
      console.log('Request body complete:', body)
      // 设置 SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
      })
      res.flushHeaders() // 立即发送响应头
      
      const response = getRandomResponse()
      const chars = [...response] // 支持 emoji 等多字节字符
      let index = 0
      
      console.log('Starting SSE stream, total chars:', chars.length)
      
      // 模拟流式输出，每 30-80ms 发送一个字符
      interval = setInterval(() => {
        if (index < chars.length) {
          const data = JSON.stringify({ 
            type: 'delta', 
            content: chars[index],
            index 
          })
          const written = res.write(`data: ${data}\n\n`)
          console.log(`Wrote char ${index}: ${chars[index]}, success: ${written}`)
          index++
        } else {
          // 发送完成信号
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          clearInterval(interval)
          res.end()
        }
      }, 30 + Math.random() * 50)
    })
    
    // 客户端断开时清理 - 放在 req.on('end') 外部，监听 res 而不是 req
    res.on('close', () => {
      console.log('Response closed by client')
      if (interval) clearInterval(interval)
    })
    
    return
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found' }))
})

server.listen(PORT, () => {
  console.log(`🚀 SSE Server running at http://localhost:${PORT}`)
})
