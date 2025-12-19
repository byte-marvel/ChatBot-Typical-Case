// chatbot.ts - web-view 页面，加载 H5 chat-bot

// 生成 sessionId
function generateSessionId(): string {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

Page({
  data: {
    webviewUrl: '',
    sessionId: '',
    isRecording: false,
    isCancelRecording: false,
    showVoiceBtn: true,
    showCameraBtn: true,
    webviewReady: false, // H5 页面是否已加载完成
    // Debug 模式
    debugMode: true, // 设为 false 关闭调试
    debugInfo: '',
    debugImageUrl: '',
  },
  
  // 录音相关状态
  touchStartY: 0,
  recorderManager: null as WechatMiniprogram.RecorderManager | null,

  onLoad() {
    const sessionId = generateSessionId()
    this.setData({ sessionId })
    
    // 获取定位信息后构建 URL
    this.getLocationAndBuildUrl(sessionId)
    
    // 初始化录音管理器
    this.initRecorderManager()
  },
  
  // 初始化录音管理器
  initRecorderManager() {
    this.recorderManager = wx.getRecorderManager()
    
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      this.setData({ isRecording: true, isCancelRecording: false })
      wx.vibrateShort({ type: 'medium' })
    })
    
    this.recorderManager.onStop((res) => {
      console.log('录音结束', res)
      const isCancelled = this.data.isCancelRecording
      this.setData({ isRecording: false, isCancelRecording: false })
      
      if (!isCancelled) {
        if (this.data.debugMode) {
          this.setData({ debugInfo: `录音文件: ${res.tempFilePath}\n时长: ${res.duration}ms` })
        }
        this.recognizeVoice(res.tempFilePath)
      } else {
        wx.showToast({ title: '已取消', icon: 'none' })
      }
    })
    
    this.recorderManager.onError((err) => {
      console.error('录音错误:', err)
      this.setData({ isRecording: false, isCancelRecording: false })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  // 获取定位信息并构建 web-view URL
  getLocationAndBuildUrl(sessionId: string) {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res
        this.buildWebviewUrl(sessionId, latitude, longitude)
      },
      fail: (err) => {
        console.error('获取定位失败:', err)
        // 定位失败时不传递位置参数
        this.buildWebviewUrl(sessionId)
      }
    })
  },

  // 构建 web-view URL
  buildWebviewUrl(sessionId: string, latitude?: number, longitude?: number) {
    // H5 页面地址，需要替换为实际部署地址
    let url = `https://frpc.aitop.chat/?sessionId=${sessionId}`
    
    if (latitude !== undefined && longitude !== undefined) {
      url += `&latitude=${latitude}&longitude=${longitude}`
    }
    
    this.setData({ webviewUrl: url })
  },

  // 处理 H5 发来的 postMessage
  onMessage(e: WechatMiniprogram.WebviewMessage) {
    const data = e.detail.data
    if (!data || data.length === 0) return
    
    // postMessage 的数据是数组，取最后一条
    const message = data[data.length - 1]
    console.log('收到 H5 消息:', message)
    
    if (message.type === 'navigateToMiniProgram') {
      // 功能1: 跳转到其他小程序
      this.navigateToMiniProgram(message.appId, message.path, message.extraData)
    } else if (message.type === 'openShortLink') {
      // 功能2a: 通过 Short Link 跳转
      this.openShortLink(message.shortLink)
    } else if (message.type === 'openSchemaUrl') {
      // 功能2b: 通过 Schema URL 跳转
      this.openSchemaUrl(message.appid, message.path)
    } else if (message.type === 'openLink') {
      // 功能2c: 通用链接处理
      this.openGenericLink(message.link)
    } else if (message.type === 'hideVoiceBtn') {
      this.setData({ showVoiceBtn: false })
    } else if (message.type === 'showVoiceBtn') {
      this.setData({ showVoiceBtn: true })
    } else if (message.type === 'hideCameraBtn') {
      this.setData({ showCameraBtn: false })
    } else if (message.type === 'showCameraBtn') {
      this.setData({ showCameraBtn: true })
    } else if (message.type === 'webviewReady') {
      // H5 页面加载完成
      console.log('H5 页面已加载完成')
      this.setData({ webviewReady: true })
    }
  },

  // 功能1: 跳转到其他小程序
  navigateToMiniProgram(appId: string, path?: string, extraData?: object) {
    wx.navigateToMiniProgram({
      appId: appId,
      path: path || '',
      extraData: extraData || {},
      success: () => {
        console.log('跳转小程序成功')
      },
      fail: (err) => {
        console.error('跳转小程序失败:', err)
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        })
      }
    })
  },

  // 功能2a: 通过 Short Link 跳转小程序
  // 格式: #小程序://大众点评丨美食团购外卖酒店电影/GCqwbsf3nFrx6nn
  openShortLink(shortLink: string) {
    console.log('打开 Short Link:', shortLink)
    
    // 使用 wx.navigateToMiniProgram 的 shortLink 参数跳转（基础库 2.18.1+）
    // 类型定义可能未更新，使用类型断言
    const navigateFn = wx.navigateToMiniProgram as (options: any) => void
    navigateFn({
      shortLink: shortLink,
      success: () => {
        console.log('通过 Short Link 跳转成功')
      },
      fail: (err: any) => {
        console.error('通过 Short Link 跳转失败:', err)
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        })
      }
    })
  },

  // 功能2b: 通过 Schema URL 跳转小程序
  // 格式: weixin://dl/business/?appid=wxa75efa648b60994b&path=pages/index/index
  openSchemaUrl(appid: string, path: string) {
    console.log('打开 Schema URL, appid:', appid, 'path:', path)
    
    // 使用 navigateToMiniProgram 跳转
    wx.navigateToMiniProgram({
      appId: appid,
      path: path || '',
      success: () => {
        console.log('通过 Schema URL 跳转成功')
      },
      fail: (err) => {
        console.error('通过 Schema URL 跳转失败:', err)
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        })
      }
    })
  },

  // 功能2c: 通用链接处理
  openGenericLink(link: string) {
    console.log('打开通用链接:', link)
    
    // 尝试判断链接类型并处理
    if (link.includes('#小程序://') || link.includes('小程序://')) {
      this.openShortLink(link)
    } else if (link.startsWith('weixin://dl/business/')) {
      // 解析 schema URL
      try {
        // 小程序环境不支持 URL 构造函数，使用正则解析
        const appidMatch = link.match(/appid=([^&]+)/)
        const pathMatch = link.match(/path=([^&]+)/)
        const appid = appidMatch ? appidMatch[1] : ''
        const pagePath = pathMatch ? decodeURIComponent(pathMatch[1]) : ''
        this.openSchemaUrl(appid, pagePath)
      } catch (e) {
        console.error('解析链接失败:', e)
        this.copyLinkFallback(link)
      }
    } else {
      // 其他链接类型，复制到剪贴板
      this.copyLinkFallback(link)
    }
  },

  // 降级方案：复制链接到剪贴板
  copyLinkFallback(link: string) {
    wx.setClipboardData({
      data: link,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  // 功能3: 语音识别 - 长按开始录音
  onVoiceTouchStart(e: WechatMiniprogram.TouchEvent) {
    // 记录触摸起始位置
    this.touchStartY = e.touches[0].clientY
    
    // 开始录音
    if (this.recorderManager) {
      this.recorderManager.start({
        duration: 60000, // 最长60秒
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      })
    }
  },
  
  // 手指移动 - 检测是否上滑取消
  onVoiceTouchMove(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isRecording) return
    
    const currentY = e.touches[0].clientY
    const deltaY = this.touchStartY - currentY
    
    // 上滑超过 50px 则标记为取消
    if (deltaY > 50) {
      if (!this.data.isCancelRecording) {
        this.setData({ isCancelRecording: true })
        wx.vibrateShort({ type: 'light' })
      }
    } else {
      if (this.data.isCancelRecording) {
        this.setData({ isCancelRecording: false })
      }
    }
  },
  
  // 松开手指 - 停止录音
  onVoiceTouchEnd() {
    if (this.data.isRecording && this.recorderManager) {
      this.recorderManager.stop()
    }
  },
  
  // 触摸取消（如来电等中断）
  onVoiceTouchCancel() {
    if (this.data.isRecording && this.recorderManager) {
      this.setData({ isCancelRecording: true })
      this.recorderManager.stop()
    }
  },

  // 语音识别 - 上传音频到后端进行识别
  recognizeVoice(filePath: string) {
    wx.showLoading({ title: '识别中...' })
    
    const { sessionId } = this.data
    
    // 上传音频文件到后端进行语音识别
    wx.uploadFile({
      url: 'https://your-server-domain.com/api/voice-recognize',
      filePath: filePath,
      name: 'audio',
      formData: {
        sessionId: sessionId
      },
      success: (res) => {
        wx.hideLoading()
        
        try {
          const data = JSON.parse(res.data)
          console.log('语音识别结果:', data)
          
          if (data.success && data.text) {
            // Debug: 显示语音识别结果
            if (this.data.debugMode) {
              this.setData({ debugInfo: `语音识别结果:\n${data.text}` })
            }
            // 将识别结果发送到后端中转服务器
            this.sendVoiceResultToServer(data.text)
          } else {
            wx.showToast({
              title: data.error || '未识别到语音',
              icon: 'none'
            })
          }
        } catch (e) {
          console.error('解析语音识别响应失败:', e)
          wx.showToast({
            title: '识别失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('语音识别失败:', err)
        wx.showToast({
          title: '识别失败',
          icon: 'none'
        })
      }
    })
  },

  // 将语音识别结果发送到后端中转服务器
  sendVoiceResultToServer(text: string) {
    const { sessionId } = this.data
    
    wx.request({
      url: 'https://your-server-domain.com/api/voice-result',
      method: 'POST',
      data: {
        sessionId: sessionId,
        text: text,
        type: 'voice'
      },
      success: (res) => {
        console.log('语音结果已发送到服务器:', res)
        wx.showToast({
          title: '已发送',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('发送语音结果失败:', err)
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        })
      }
    })
  },

  // 关闭调试面板
  closeDebugPanel() {
    this.setData({ debugInfo: '', debugImageUrl: '' })
  },

  // web-view 加载完成
  onWebviewLoad(e: any) {
    console.log('web-view 加载完成:', e.detail.src)
    // 延迟 1 秒后显示工具栏，确保 H5 页面完全渲染
    setTimeout(() => {
      this.setData({ webviewReady: true })
    }, 1000)
  },

  // 功能4: 拍照悬浮球点击
  onCameraTap() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        console.log('拍照成功:', tempFilePath)
        
        // Debug: 显示拍照结果
        if (this.data.debugMode) {
          this.setData({ 
            debugInfo: `拍照文件: ${tempFilePath}`,
            debugImageUrl: tempFilePath 
          })
        }
        
        // 上传图片
        this.uploadImage(tempFilePath)
      },
      fail: (err) => {
        console.error('拍照失败:', err)
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        })
      }
    })
  },

  // 上传图片到服务器
  uploadImage(filePath: string) {
    wx.showLoading({ title: '上传中...' })
    
    const { sessionId } = this.data
    
    wx.uploadFile({
      url: 'https://your-server-domain.com/api/upload-image',
      filePath: filePath,
      name: 'image',
      formData: {
        sessionId: sessionId
      },
      success: (res) => {
        wx.hideLoading()
        
        try {
          const data = JSON.parse(res.data)
          console.log('图片上传成功:', data)
          
          if (data.url) {
            // Debug: 显示上传后的图片 URL
            if (this.data.debugMode) {
              this.setData({ debugInfo: `图片上传成功:\n${data.url}` })
            }
            // 将图片 URL 发送到后端中转服务器
            this.sendImageUrlToServer(data.url)
          }
        } catch (e) {
          console.error('解析上传响应失败:', e)
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('图片上传失败:', err)
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    })
  },

  // 将图片 URL 发送到后端中转服务器
  sendImageUrlToServer(imageUrl: string) {
    const { sessionId } = this.data
    
    wx.request({
      url: 'https://your-server-domain.com/api/image-result',
      method: 'POST',
      data: {
        sessionId: sessionId,
        imageUrl: imageUrl,
        type: 'image'
      },
      success: (res) => {
        console.log('图片URL已发送到服务器:', res)
        wx.showToast({
          title: '已发送',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('发送图片URL失败:', err)
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        })
      }
    })
  },
})
