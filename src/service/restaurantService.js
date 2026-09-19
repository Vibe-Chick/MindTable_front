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
  { id: 'm3', name: '오늘의 파스타', cuisine: '양식', walk: '6분', price: 'mid', discount: null, hue: ['#EEF2F6', '#D5DEE8'], lat: 37.5563, lng: 127.0421 },
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
const VOTES_KEY = 'mt_mock_votes'

// ---------- ① 그룹 조건 제출 (위치 · 예산 · 못 먹는 음식) ----------
export async function submitPreferences(matchId, prefs) {
  if (!isLive('restaurants/preferences')) {
    await sleep(600)
    saveJson(PREFS_KEY, { ...loadJson(PREFS_KEY, {}), [matchId]: prefs })
    // mock: 다른 멤버 조건과 합친 "공통 조건"
    return {
      submitted: 4,
      total: 4,
      common: { location: prefs.location === 'custom' ? prefs.customLocation : '왕십리역 인근', price: prefs.price, avoid: prefs.avoid },
    }
  }
  const { data } = await api.post(`/match/${matchId}/restaurants/preferences/`, prefs)
  return data
}

// ---------- ② 식당 추천: 제휴 DB 조회 → 없으면 지도 API fallback ----------
// 응답: { source: 'partner' | 'map', restaurants: [...] }
export async function getRecommendedRestaurants(matchId, prefs) {
  if (!isLive('restaurants/list')) {
    await sleep(700)
    // mock: 제휴 식당은 캠퍼스 근처에만 있다고 가정 → 장소를 직접 입력하면 제휴 DB에 없어서 지도 API fallback
    if (prefs?.location === 'custom') return { source: 'map', restaurants: MOCK_MAP_RESTAURANTS }
    return { source: 'partner', restaurants: MOCK_RESTAURANTS }
  }
  const { data } = await api.get(`/match/${matchId}/restaurants/`, { params: prefs })
  return data
}

// ---------- ③ 투표: 각자 1표, 과반이면 확정 ----------
export async function getVotes(matchId) {
  if (!isLive('restaurants/vote')) {
    await sleep(200)
    const all = loadJson(VOTES_KEY, {})
    const state = all[matchId] ?? { votes: {}, confirmed: null }
    // mock: 내가 투표하고 3초쯤 지나면 나머지 멤버가 투표한 것으로 처리 → 과반 확정
    if (state.pending && !state.confirmed && Date.now() - state.castAt > 3000) {
      const { members, mine } = state.pending
      members.forEach((m) => {
        if (!state.votes[m.id]) state.votes[m.id] = mine
      })
      state.confirmed = tallyWinner(state.votes, members.length)
      state.pending = null
      saveJson(VOTES_KEY, { ...all, [matchId]: state })
    }
    return state
  }
  const { data } = await api.get(`/match/${matchId}/vote/`)
  return data
}

export async function castVote(matchId, restaurantId, { userId, members, candidates }) {
  if (!isLive('restaurants/vote')) {
    await sleep(400)
    const all = loadJson(VOTES_KEY, {})
    const state = all[matchId] ?? { votes: {}, confirmed: null }
    state.votes[userId] = restaurantId
    // mock: 다른 멤버 한 명은 바로 다른 곳에 투표(대기 상태 연출), 나머지는 getVotes 폴링 때 채워진다
    const others = members.filter((m) => m.id !== userId)
    if (others[0] && !state.votes[others[0].id]) {
      state.votes[others[0].id] = candidates[(candidates.indexOf(restaurantId) + 1) % candidates.length]
    }
    state.confirmed = tallyWinner(state.votes, members.length)
    state.castAt = Date.now()
    state.pending = state.confirmed ? null : { members: others, mine: restaurantId }
    saveJson(VOTES_KEY, { ...all, [matchId]: state })
    return state
  }
  const { data } = await api.post(`/match/${matchId}/vote/`, { restaurantId })
  return data
}

// 과반 득표 식당 id, 없으면 null
function tallyWinner(votes, total) {
  const tally = Object.values(votes).reduce((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {})
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return top && top[1] > total / 2 ? top[0] : null
}

// ---------- 확정 후 예약 ----------
export async function reserveRestaurant(matchId, restaurantId) {
  if (USE_MOCK) {
    await sleep(500)
    return { ok: true, reservationId: `rsv-${restaurantId}` }
  }
  const { data } = await api.post(`/match/${matchId}/reserve`, { restaurantId })
  return data
}
