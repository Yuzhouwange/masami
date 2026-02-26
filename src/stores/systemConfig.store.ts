import { defineStore } from 'pinia'

// 本地实现 jsonParse 函数
function jsonParse<T>(str: string | null, defaultValue: T): T {
  if (!str) return defaultValue
  try {
    return JSON.parse(str) as T
  } catch {
    return defaultValue
  }
}

const STATIC_RESOURCES_STORE_KEY = 'STATIC_RESOURCES_STORE'

interface StaticResource {
  /** 核心播放器进度条的当前图标地址 */
  videoProgressCurIcon: string
}

export function getServerIp() {
  // 通过环境变量 VITE_API_BASE 配置，见 .env 文件
  return import.meta.env.VITE_API_BASE || '/'
}

export function getStaticResource() {
  const data = localStorage.getItem(STATIC_RESOURCES_STORE_KEY)
  const origin = {
    videoProgressCurIcon: ''
  }
  return jsonParse<StaticResource>(data, origin) || origin
}

export const useSystemConfigStore = defineStore('SystemConfig', {
  state: () => ({
    serverIp: import.meta.env.VITE_API_BASE || '/', // 通过环境变量配置
    staticResource: {
      videoProgressCurIcon: ''
    } as StaticResource
  }),
  actions: {
    init() {
      this.getServerIp()
      this.getStaticResource()
    },
    saveServerIp(url: string) {
      // 由于我们内置了API地址，这里不再保存
    },
    getServerIp() {
      this.serverIp = getServerIp()
    },
    saveStaticResource(resource: StaticResource) {
      // 由于我们内置了静态资源，这里不再保存
      this.staticResource = resource
    },
    getStaticResource() {
      // 使用内置的静态资源
      this.staticResource = getStaticResource()
    }
  }
})