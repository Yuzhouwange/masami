/**
 * 通用请求超时时间
 */
export const timeout = 14000
/**
 * 接口基准头
 * 通过 .env 文件中的 VITE_API_BASE 设置，例如：
 *   VITE_API_BASE=http://localhost:3000/
 * 生产环境使用相对路径（同域部署时留空即可）
 */
export const BASE_COMIC_URL =
  import.meta.env.VITE_API_BASE || '/'
