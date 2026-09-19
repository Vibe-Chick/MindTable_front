import api, { isLive } from './api'
import { loadJson, saveJson } from '../utils'

// ---------- Web Push ----------
// 흐름: 권한 요청 → 서비스 워커 등록 → PushManager 구독(VAPID 공개키) → 구독 정보를 백엔드에 저장
//       → 백엔드가 매칭 완료 / 장소 확정 / 식사 2시간 후에 pywebpush 로 발송 → sw.js 가 OS 알림 표시
//
// mock 모드(백엔드 없음)에서는 구독 대신 권한만 받고, 프론트 플로우의 같은 시점에
// notifyLocal() 로 서비스 워커에 직접 알림을 띄워 실제 OS 알림을 확인할 수 있다.

export const PUSH_TYPES = [
  { key: 'match_done', label: '매칭 완료', desc: '그룹이 확정됐을 때' },
  { key: 'place_confirmed', label: '장소 확정', desc: 'AI가 식당을 정했을 때' },
  { key: 'review_request', label: '테이블 리뷰 요청', desc: '식사 2시간 후' },
]

const PREFS_KEY = 'mt_push_prefs'
const SUB_KEY = 'mt_push_subscription'
const DEFAULT_PREFS = { enabled: false, match_done: true, place_confirmed: true, review_request: true }

// ---------- 지원 여부 / 환경 ----------
export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window
}

export function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// 홈 화면에 추가된 PWA 로 열렸는지 (iOS 는 이 상태에서만 푸시 가능)
export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
}

export function needsIOSInstall() {
  return isIOS() && !isStandalone()
}

export function getPermission() {
  return isPushSupported() ? Notification.permission : 'unsupported'
}

// ---------- 설정 ----------
export function getPrefs() {
  return { ...DEFAULT_PREFS, ...loadJson(PREFS_KEY, {}) }
}

export async function savePrefs(prefs) {
  saveJson(PREFS_KEY, prefs)
  if (isLive('push/preferences')) {
    await api.patch('/push/preferences/', prefs)
  }
  return prefs
}

// ---------- 서비스 워커 ----------
export async function registerServiceWorker() {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

// ---------- 구독 ----------
export async function enablePush() {
  if (!isPushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요')
  if (needsIOSInstall()) throw new Error('IOS_INSTALL_REQUIRED')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? '알림이 차단돼 있어요. 브라우저 사이트 설정에서 허용으로 바꿔줘' : '알림 권한을 허용해줘야 받을 수 있어')
  }

  const reg = await registerServiceWorker()
  if (!reg) throw new Error('서비스 워커를 등록하지 못했어요')
  await navigator.serviceWorker.ready

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (isLive('push/subscribe')) {
    if (!vapidKey) throw new Error('VAPID 공개키(VITE_VAPID_PUBLIC_KEY)가 설정되지 않았어요')
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }))
    await api.post('/push/subscribe/', subscription.toJSON())
    saveJson(SUB_KEY, { endpoint: subscription.endpoint, device: describeDevice() })
  } else {
    // mock: 실제 구독 없이 권한만 저장 (notifyLocal 로 OS 알림 확인 가능)
    saveJson(SUB_KEY, { endpoint: 'mock', device: describeDevice() })
  }

  const prefs = { ...getPrefs(), enabled: true }
  await savePrefs(prefs)
  return prefs
}

export async function disablePush() {
  if (isPushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      if (isLive('push/subscribe')) await api.delete('/push/subscribe/', { data: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
  }
  localStorage.removeItem(SUB_KEY)
  const prefs = { ...getPrefs(), enabled: false }
  await savePrefs(prefs)
  return prefs
}

export function getSubscriptionInfo() {
  return loadJson(SUB_KEY)
}

// ---------- mock 발송 ----------
// 실서버에서는 백엔드가 발송하므로 아무것도 하지 않는다.
export async function notifyLocal({ type, title, body, url }) {
  if (isLive('push/subscribe')) return false
  const prefs = getPrefs()
  if (!prefs.enabled || prefs[type] === false) return false
  if (getPermission() !== 'granted') return false
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker())
  if (!reg) return false
  await reg.showNotification(title, { body, icon: '/favicon.svg', badge: '/favicon.svg', tag: type, data: { url } })
  return true
}

// ---------- helpers ----------
function describeDevice() {
  const ua = navigator.userAgent
  const os = /Android/i.test(ua) ? 'Android' : isIOS() ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : '기기'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '브라우저'
  return `${browser} · ${os}`
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
