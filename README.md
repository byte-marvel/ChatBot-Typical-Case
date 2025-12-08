# Chatbot Demo - SSE 流式对话

一个典型的 Chatbot 前端项目，演示 SSE 接口使用、气泡内容实时更新和对话卡片设计模式。

## 特性

- **SSE 流式响应** - 使用 Server-Sent Events 实现打字机效果
- **实时气泡更新** - 字符级别的流式内容渲染
- **对话卡片布局** - 典型的聊天界面设计
- **性能优化** - React.memo、RAF 节流、智能滚动

## 技术栈

- **前端**: React 18 + Vite + TailwindCSS
- **后端**: Node.js 原生 HTTP 服务器
- **通信**: SSE (Server-Sent Events)

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（前端 + 后端）
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
├── server/
│   └── index.js          # SSE 服务端
├── src/
│   ├── components/
│   │   ├── ChatBubble.jsx    # 聊天气泡
│   │   ├── ChatInput.jsx     # 输入框
│   │   └── MessageList.jsx   # 消息列表
│   ├── hooks/
│   │   ├── useSSE.js         # SSE 连接 Hook
│   │   └── useAutoScroll.js  # 自动滚动 Hook
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
└── package.json
```

## 性能优化要点

1. **React.memo** - 避免消息组件不必要的重渲染
2. **requestAnimationFrame** - 节流自动滚动
3. **函数式状态更新** - 避免闭包陷阱
4. **CSS transform** - 使用 GPU 加速动画
5. **智能滚动检测** - 用户手动滚动时暂停自动滚动

## SSE 协议说明

服务端发送的数据格式：

```
data: {"type": "delta", "content": "字"}

data: {"type": "done"}
```

- `delta` - 增量内容
- `done` - 流式传输完成
