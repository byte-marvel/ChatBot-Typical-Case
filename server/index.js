import http from 'http'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3001

// 存储小程序发送的语音/图片数据，供 H5 轮询
// key: sessionId, value: { type: 'voice'|'image', data: string, timestamp: number }
const sessionDataStore = new Map()

// 清理过期数据（5分钟过期）
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of sessionDataStore.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) {
      sessionDataStore.delete(key)
    }
  }
}, 60 * 1000)

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
  
  // 功能3: 语音识别接口 - 接收音频文件并返回识别结果
  // 注意：实际生产环境需要接入第三方语音识别服务（如百度、讯飞、腾讯云等）
  if (url.pathname === '/api/voice-recognize' && req.method === 'POST') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] || ''
      
      // 解析 sessionId
      let sessionId = ''
      const boundaryMatch = contentType.match(/boundary=(.+)/)
      if (boundaryMatch) {
        const boundary = boundaryMatch[1]
        const parts = buffer.toString('binary').split('--' + boundary)
        
        for (const part of parts) {
          if (part.includes('name="sessionId"')) {
            const valueStart = part.indexOf('\r\n\r\n')
            if (valueStart !== -1) {
              sessionId = part.slice(valueStart + 4, part.lastIndexOf('\r\n')).trim()
            }
          }
        }
      }
      
      // TODO: 实际生产环境需要：
      // 1. 保存音频文件
      // 2. 调用第三方语音识别 API（百度、讯飞、腾讯云等）
      // 3. 返回识别结果
      
      // 这里返回模拟结果，实际需要替换为真实的语音识别服务
      console.log(`[Voice Recognize] Received audio for session: ${sessionId}`)
      
      // 模拟语音识别结果
      const mockTexts = [
        '你好，请问有什么可以帮助你的？',
        '今天天气怎么样？',
        '帮我查一下附近的餐厅',
        '我想了解一下产品信息'
      ]
      const mockText = mockTexts[Math.floor(Math.random() * mockTexts.length)]
      
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        success: true, 
        text: mockText,
        sessionId: sessionId
      }))
    })
    return
  }
  
  // 功能3: 接收小程序语音识别结果（用于中转给 H5）
  if (url.pathname === '/api/voice-result' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const { sessionId, text } = data
        
        if (!sessionId || !text) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing sessionId or text' }))
          return
        }
        
        // 存储语音识别结果
        sessionDataStore.set(sessionId, {
          type: 'voice',
          data: text,
          timestamp: Date.now()
        })
        
        console.log(`[Voice] Stored for session ${sessionId}: ${text}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }
  
  // 功能4: 接收小程序图片上传结果
  if (url.pathname === '/api/image-result' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const { sessionId, imageUrl } = data
        
        if (!sessionId || !imageUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing sessionId or imageUrl' }))
          return
        }
        
        // 存储图片 URL
        sessionDataStore.set(sessionId, {
          type: 'image',
          data: imageUrl,
          timestamp: Date.now()
        })
        
        console.log(`[Image] Stored for session ${sessionId}: ${imageUrl}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
    return
  }
  
  // 功能4: 图片上传接口
  if (url.pathname === '/api/upload-image' && req.method === 'POST') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      // 简单处理 multipart/form-data，实际生产环境建议使用 multer 等库
      const buffer = Buffer.concat(chunks)
      const contentType = req.headers['content-type'] || ''
      
      // 生成文件名
      const filename = `image_${Date.now()}.jpg`
      const uploadDir = path.join(__dirname, 'uploads')
      
      // 确保上传目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      
      // 从 multipart 数据中提取文件内容（简化处理）
      const boundaryMatch = contentType.match(/boundary=(.+)/)
      if (boundaryMatch) {
        const boundary = boundaryMatch[1]
        const parts = buffer.toString('binary').split('--' + boundary)
        
        for (const part of parts) {
          if (part.includes('filename=')) {
            // 找到文件数据的起始位置（两个换行后）
            const headerEnd = part.indexOf('\r\n\r\n')
            if (headerEnd !== -1) {
              const fileData = part.slice(headerEnd + 4, part.lastIndexOf('\r\n'))
              const filePath = path.join(uploadDir, filename)
              fs.writeFileSync(filePath, fileData, 'binary')
              
              // 返回文件 URL
              const fileUrl = `http://localhost:${PORT}/uploads/${filename}`
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true, url: fileUrl }))
              return
            }
          }
        }
      }
      
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to parse upload' }))
    })
    return
  }
  
  // 静态文件服务（用于访问上传的图片）
  if (url.pathname.startsWith('/uploads/')) {
    const filename = url.pathname.replace('/uploads/', '')
    const filePath = path.join(__dirname, 'uploads', filename)
    
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif'
      }
      
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
      return
    }
  }
  
  // H5 轮询接口 - 获取小程序发送的数据
  if (url.pathname === '/api/poll' && req.method === 'GET') {
    const sessionId = url.searchParams.get('sessionId')
    
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing sessionId' }))
      return
    }
    
    const data = sessionDataStore.get(sessionId)
    
    if (data) {
      // 获取后删除数据（一次性消费）
      sessionDataStore.delete(sessionId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        success: true, 
        type: data.type, 
        data: data.data 
      }))
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, data: null }))
    }
    return
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found' }))
})

server.listen(PORT, () => {
  console.log(`🚀 SSE Server running at http://localhost:${PORT}`)
})
