import axios from 'axios'

// VITE_USE_MOCK=true 이면 기본적으로 mock 데이터로 동작하되,
// VITE_LIVE_APIS 에 적힌 API(쉼표 구분)만 실제 백엔드로 보낸다.
// 예) VITE_LIVE_APIS=auth/google,profile/analyze
// 백엔드가 완성되는 순서대로 하나씩 켤 수 있다.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const LIVE_APIS = (import.meta.env.VITE_LIVE_APIS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function isLive(name) {
  return !USE_MOCK || LIVE_APIS.includes(name)
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 백엔드(DRF)가 { error: "..." } 로 주는 메시지를 Error.message 로 꺼내 화면에 그대로 보여준다
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data
    const message =
      data?.error || data?.detail || data?.message || (err.code === 'ECONNABORTED' ? '서버 응답이 없어요' : null)
    if (message) err.message = message
    else if (!err.response) err.message = '서버에 연결할 수 없어요. 백엔드가 켜져 있는지 확인해줘'
    return Promise.reject(err)
  },
)

export default api
