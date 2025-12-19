// 微信 JSSDK 类型声明
// 用于 H5 在小程序 web-view 中与小程序通信

interface WxMiniProgram {
  /** 向小程序发送消息 */
  postMessage: (options: { data: any }) => void
  /** 返回上一页 */
  navigateBack: (options?: { delta?: number }) => void
  /** 跳转到小程序页面 */
  navigateTo: (options: { url: string }) => void
  /** 重定向到小程序页面 */
  redirectTo: (options: { url: string }) => void
  /** 切换到小程序 Tab 页面 */
  switchTab: (options: { url: string }) => void
  /** 重启小程序 */
  reLaunch: (options: { url: string }) => void
  /** 获取当前环境 */
  getEnv: (callback: (res: { miniprogram: boolean }) => void) => void
}

interface Wx {
  miniProgram: WxMiniProgram
}

declare global {
  interface Window {
    wx?: Wx
  }
}

export {}
