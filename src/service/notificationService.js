import api, { isLive } from './api'
import { sleep, loadJson, saveJson } from '../utils'

// 알림 종류와 탭했을 때 이동할 곳
export const NOTIFICATION_TYPES = {
  match_done: { icon: '✨', title: '매칭이 완료됐어요', to: () => '/matching/result' },
  place_confirmed: { icon: '📍', title: '식사 장소가 확정됐어요', to: () => '/restaurants' },
  review_request: { icon: '📝', title: '오늘 식사 어땠어요?', to: (n) => `/review/${n.matchId}` },
  school_verified: { icon: '🎓', title: '학교 인증이 완료됐어요', to: () => '/home' },
}

const KEY = 'mt_mock_notifications'

function getAll() {
  return loadJson(KEY, [])
}

// ---------- 조회 ----------
export async function getNotifications() {
  if (!isLive('notifications')) {
    await sleep(150)
    return getAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
  const { data } = await api.get('/notifications/')
  return data
}

// ---------- 읽음 처리 ----------
export async function markRead(id) {
  if (!isLive('notifications')) {
    saveJson(KEY, getAll().map((n) => (n.id === id ? { ...n, read: true } : n)))
    return { ok: true }
  }
  const { data } = await api.patch(`/notifications/${id}/`, { read: true })
  return data
}

export async function markAllRead() {
  if (!isLive('notifications')) {
    saveJson(KEY, getAll().map((n) => ({ ...n, read: true })))
    return { ok: true }
  }
  const { data } = await api.post('/notifications/read-all/')
  return data
}

// ---------- 생성 (mock 전용) ----------
// 실서버에서는 백엔드가 매칭 완료/장소 확정/식사 2시간 후에 직접 알림을 만든다.
// mock 모드에서는 프론트 플로우에서 같은 시점에 이 함수를 불러 흉내낸다.
export function pushLocalNotification({ type, body, matchId, delayMs = 0 }) {
  if (isLive('notifications')) return null
  const n = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    body,
    matchId: matchId ?? null,
    read: false,
    createdAt: new Date(Date.now() + delayMs).toISOString(),
  }
  const all = getAll()
  // 같은 매칭·같은 종류 알림은 한 번만
  if (all.some((x) => x.type === type && x.matchId === n.matchId)) return null
  saveJson(KEY, [...all, n])
  window.dispatchEvent(new Event('mt:notifications'))
  return n
}
