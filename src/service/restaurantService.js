import api, { USE_MOCK } from './api'
import { sleep } from '../utils'

const MOCK_RESTAURANTS = [
  { id: 'r1', name: '온기설렁탕', cuisine: '한식', walk: '7분', discount: '매칭 그룹 15% 할인', hue: ['#FFDCD2', '#FFB199'] },
  { id: 'r2', name: '나폴리 화덕피자', cuisine: '이탈리안', walk: '5분', discount: '웰컴 사이드 메뉴 무료', hue: ['#FFE9DE', '#FFC9A8'] },
  { id: 'r3', name: '청년다반사', cuisine: '브런치', walk: '10분', discount: '매칭 그룹 10% 할인', hue: ['#FFEADD', '#FFD2B8'] },
]

// 매칭 그룹 기반 제휴 식당 추천
export async function getRecommendedRestaurants(matchId) {
  if (USE_MOCK) {
    await sleep(500)
    return MOCK_RESTAURANTS
  }
  const { data } = await api.get(`/match/${matchId}/restaurants`)
  return data
}

export async function reserveRestaurant(matchId, restaurantId) {
  if (USE_MOCK) {
    await sleep(500)
    return { ok: true, reservationId: `rsv-${restaurantId}` }
  }
  const { data } = await api.post(`/match/${matchId}/reserve`, { restaurantId })
  return data
}
