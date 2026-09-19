import api, { USE_MOCK, isLive } from './api'
import { sleep, loadJson, saveJson } from '../utils'

const MOCK_RESTAURANTS = [
  { id: 'r1', name: '온기설렁탕', cuisine: '한식', walk: '7분', price: 'mid', discount: '매칭 그룹 15% 할인', hue: ['#FFDCD2', '#FFB199'], lat: 37.5575, lng: 127.0455 },
  { id: 'r2', name: '나폴리 화덕피자', cuisine: '이탈리안', walk: '5분', price: 'high', discount: '웰컴 사이드 메뉴 무료', hue: ['#FFE9DE', '#FFC9A8'], lat: 37.5568, lng: 127.0431 },
  { id: 'r3', name: '청년다반사', cuisine: '브런치', walk: '10분', price: 'low', discount: '매칭 그룹 10% 할인', hue: ['#FFEADD', '#FFD2B8'], lat: 37.5590, lng: 127.0470 },
]

// 제휴 식당이 없을 때 지도 API로 찾은 근처 식당 (할인 없음)
const MOCK_MAP_RESTAURANTS = [
  { id: 'm1', name: '왕십리 곱창골목 본점', cuisine: '한식', walk: '9분', price: 'mid', discount: null, hue: ['#EEF2F6', '#D5DEE8'], lat: 37.5610, lng: 127.0380 },
  { id: 'm2', name: '한양 돈까스', cuisine: '일식', walk: '4분', price: 'low', discount: null, hue: ['#EEF2F6', '#D5DEE8'], lat: 37.5571, lng: 127.0448 },
  { id: 'm3', name: '오늘의 파스타', cuisine: '양식', walk: '6분', price: 'high', discount: null, hue: ['#EEF2F6', '#D5DEE8'], lat: 37.5563, lng: 127.0421 },
]

export const PRICE_OPTIONS = [
  { value: 'low', label: '1만원 이하' },
  { value: 'mid', label: '1~2만원' },
  { value: 'high', label: '2만원 이상' },
]

export const LOCATION_OPTIONS = [
  { value: 'my-school', label: '내 학교 근처' },
  { value: 'midpoint', label: '멤버 중간 지점' },
  { value: 'custom', label: '직접 입력' },
]

const PREFS_KEY = 'mt_mock_restaurant_prefs'

// ---------- ① 그룹 조건 제출 (위치 · 예산 · 못 먹는 음식) ----------
export async function submitPreferences(matchId, prefs, { total } = {}) {
  if (!isLive('restaurants/preferences')) {
    await sleep(600)
    saveJson(PREFS_KEY, { ...loadJson(PREFS_KEY, {}), [matchId]: { prefs, total, submittedAt: Date.now() } })
    return { submitted: 1, total, common: mockCommon(prefs) }
  }
  const { data } = await api.post(`/match/${matchId}/restaurants/preferences/`, prefs)
  return data
}

// ---------- ② AI 식당 추천: 멤버 전원 조건 제출 → 제휴 DB 우선, 없으면 지도 API → 한 곳만 골라준다 ----------
// 응답: { status: 'waiting' | 'done', submitted, total, common, source: 'partner' | 'map' | null, restaurant: {...} | null, reason }
// 프론트는 waiting 동안 2초마다 폴링
export async function getRecommendedRestaurant(matchId) {
  if (!isLive('restaurants/list')) {
    await sleep(200)
    const saved = loadJson(PREFS_KEY, {})[matchId]
    if (!saved) return { status: 'waiting', submitted: 0, total: 0, common: null, source: null, restaurant: null, reason: null }
    const { prefs, total, submittedAt } = saved
    // mock: 내가 제출하고 1.5초마다 다른 멤버가 한 명씩 제출한 것으로 처리 → 전원 제출되면 AI 추천
    const submitted = Math.min(total, 1 + Math.floor((Date.now() - submittedAt) / 1500))
    const common = mockCommon(prefs)
    if (submitted < total) return { status: 'waiting', submitted, total, common, source: null, restaurant: null, reason: null }
    // mock: 제휴 식당은 캠퍼스 근처에만 있다고 가정 → 장소를 직접 입력하면 제휴 DB에 없어서 지도 API fallback
    const pool = prefs.location === 'custom' ? MOCK_MAP_RESTAURANTS : MOCK_RESTAURANTS
    const restaurant = pool.find((r) => r.price === prefs.price) ?? pool[0]
    return {
      status: 'done',
      submitted,
      total,
      common,
      source: prefs.location === 'custom' ? 'map' : 'partner',
      restaurant,
      reason: `${common.location}에서 ${PRICE_OPTIONS.find((p) => p.value === common.price)?.label} 예산에 맞고${common.avoid ? ` ${common.avoid} 메뉴가 없어` : ''} 멤버 모두가 편하게 갈 수 있는 곳이에요`,
    }
  }
  const { data } = await api.get(`/match/${matchId}/restaurants/`)
  return data
}

// mock: 다른 멤버 조건과 합친 "공통 조건"
function mockCommon(prefs) {
  return { location: prefs.location === 'custom' ? prefs.customLocation : '왕십리역 인근', price: prefs.price, avoid: prefs.avoid }
}

// ---------- ③ 추천 확정 후 예약 ----------
export async function reserveRestaurant(matchId, restaurantId) {
  if (USE_MOCK) {
    await sleep(500)
    return { ok: true, reservationId: `rsv-${restaurantId}` }
  }
  const { data } = await api.post(`/match/${matchId}/reserve/`, { restaurantId })
  return data
}
