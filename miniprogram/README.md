# 微信小程序 - ChatBot 集成说明

## 项目结构

```
miniprogram/
├── miniprogram/
│   ├── app.json          # 小程序配置
│   ├── app.ts            # 小程序入口
│   ├── pages/
│   │   ├── index/        # 首页（含悬浮球入口）
│   │   ├── logs/         # 日志页
│   │   └── chatbot/      # web-view 页面（加载 H5）
│   └── utils/
├── project.config.json   # 项目配置
└── tsconfig.json
```

## 功能说明

### 1. 悬浮球入口
- 在首页 (`pages/index`) 添加了 AI 助手悬浮球
- 点击悬浮球跳转到 `pages/chatbot/chatbot` 页面

### 2. Web-View 页面 (chatbot)
加载 H5 chat-bot 页面，并提供以下功能：

#### 功能1: H5 触发跳转其他小程序
- H5 通过 `wx.miniProgram.postMessage` 发送消息
- 小程序监听 `bindmessage` 事件
- 收到 `type: 'navigateToMiniProgram'` 消息后调用 `wx.navigateToMiniProgram`

```javascript
// H5 端调用示例
wx.miniProgram.postMessage({
  data: {
    type: 'navigateToMiniProgram',
    appId: 'wx1234567890',
    path: '/pages/index/index',
    extraData: { foo: 'bar' }
  }
})
```

#### 功能2: 定位信息传递
- 进入 web-view 前，小程序调用 `wx.getLocation` 获取定位
- 通过 URL 查询参数传递给 H5：`?sessionId=xxx&latitude=xxx&longitude=xxx`

#### 功能3: 语音识别悬浮球
- 小程序界面显示语音悬浮球，H5 界面隐藏
- 点击开始录音，再次点击停止
- 录音文件上传到后端服务器进行语音识别（需接入第三方语音识别服务）
- 识别结果通过后端中转服务器传递给 H5
- H5 通过 sessionId 轮询获取结果

#### 功能4: 拍照悬浮球
- 小程序界面显示拍照悬浮球，H5 界面隐藏
- 点击调用 `wx.chooseMedia` 拍照
- 图片上传到服务器获取 URL
- URL 通过后端中转服务器传递给 H5
- H5 通过 sessionId 轮询获取结果

## 配置要求

### 1. app.json 配置
```json
{
  "permission": {
    "scope.userLocation": {
      "desc": "用于获取您的位置信息以提供更好的服务"
    },
    "scope.record": {
      "desc": "用于语音输入功能"
    }
  }
}
```

### 2. 业务域名配置
在微信公众平台配置业务域名，添加 H5 页面的域名。

### 3. 服务器域名配置
配置 request 合法域名，添加后端服务器域名。

## 服务器 API

### POST /api/voice-result
接收语音识别结果
```json
{
  "sessionId": "session_xxx",
  "text": "识别的文字",
  "type": "voice"
}
```

### POST /api/image-result
接收图片上传结果
```json
{
  "sessionId": "session_xxx",
  "imageUrl": "https://xxx/image.jpg",
  "type": "image"
}
```

### POST /api/upload-image
图片上传接口，返回图片 URL

### GET /api/poll?sessionId=xxx
H5 轮询接口，获取小程序发送的数据

## 注意事项

1. **postMessage 触发时机**：`wx.miniProgram.postMessage` 的消息只有在特定时机才会被触发（如页面返回、分享等），如需立即触发可配合 `navigateBack`

2. **语音识别插件**：需要在小程序后台添加「微信同声传译」插件

3. **定位权限**：首次使用需要用户授权

4. **HTTPS**：H5 页面必须使用 HTTPS 协议

5. **域名白名单**：所有请求的域名都需要在小程序后台配置
