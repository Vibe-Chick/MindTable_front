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

// ---------- access 토큰 자동 갱신 ----------
// access 토큰 수명은 백엔드가 정한다(기본 5분). 프론트는 만료(401)를 감지하면
// 로그인 때 받아둔 refresh 토큰으로 새 access 를 받고, 원래 요청을 한 번 재시도한다.
// 백엔드: POST /api/auth/token/refresh/  { refresh }  → { access }   (SimpleJWT TokenRefreshView)
// 갱신도 실패하면(refresh 만료·경로 없음) 세션을 지우고 로그인 화면으로 보낸다.
const REFRESH_URL = '/auth/token/refresh/'
let refreshing = null // 동시에 여러 요청이 401 을 받아도 갱신은 한 번만

async function refreshAccessToken() {
  const refresh = localStorage.getItem('mt_refresh')
  if (!refresh) throw new Error('no refresh token')
  const { data } = await axios.post(`${api.defaults.baseURL}${REFRESH_URL}`, { refresh })
  localStorage.setItem('mt_token', data.access)
  if (data.refresh) localStorage.setItem('mt_refresh', data.refresh) // ROTATE_REFRESH_TOKENS 켠 경우
  return data.access
}

function clearSession() {
  ;['mt_token', 'mt_refresh', 'mt_user'].forEach((k) => localStorage.removeItem(k))
  if (window.location.pathname !== '/login') window.location.replace('/login')
}

// 백엔드(DRF)가 { error: "..." } 로 주는 메시지를 Error.message 로 꺼내 화면에 그대로 보여준다
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err
    // 로그인·갱신 자체의 401 은 갱신 대상이 아니다
    const isAuthCall = config?.url?.startsWith('/auth/google') || config?.url?.startsWith(REFRESH_URL)
    if (response?.status === 401 && !isAuthCall && !config._retried && localStorage.getItem('mt_refresh')) {
      config._retried = true
      try {
        refreshing = refreshing ?? refreshAccessToken().finally(() => (refreshing = null))
        const access = await refreshing
        config.headers.Authorization = `Bearer ${access}`
        return api(config)
      } catch {
        clearSession()
      }
    }

    const data = response?.data
    const message =
      data?.error || data?.detail || data?.message || (err.code === 'ECONNABORTED' ? '서버 응답이 없어요' : null)
    if (message) err.message = message
    else if (!response) err.message = '서버에 연결할 수 없어요. 백엔드가 켜져 있는지 확인해줘'
    else if (response.status === 404) err.message = `서버에 아직 없는 API예요 (404: ${config?.url})`
    else if (response.status === 401) err.message = '로그인이 만료됐어요. 다시 로그인해줘'
    else if (response.status >= 500) err.message = '서버 오류가 났어요. 잠시 후 다시 시도해줘'
    return Promise.reject(err)
  },
)

export default api
