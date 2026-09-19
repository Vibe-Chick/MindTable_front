import { useEffect } from 'react'

const LAST_ACTIVE_KEY = 'mt_last_active'
// 사용자가 뭔가 하고 있다고 볼 이벤트들
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

// 로그인 상태에서 idleMs 동안 아무 동작이 없으면 onIdle() 호출.
// 동작이 있을 때마다 타이머를 처음부터 다시 잰다.
// 마지막 활동 시각을 localStorage 에 남겨서, 탭을 닫았다가 30분 뒤에 다시 열어도 로그아웃된다.
// (백엔드 access 토큰 수명과는 별개 — 그쪽 만료는 api.js 의 refresh 갱신이 처리)
export function useIdleLogout(enabled, onIdle, idleMs = 30 * 60 * 1000) {
  useEffect(() => {
    if (!enabled) return undefined

    let timer
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(onIdle, idleMs)
    }

    // 활동 시각 기록은 1초에 한 번만 (mousemove 가 초당 수십 번 오므로)
    let lastWrite = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite > 1000) {
        localStorage.setItem(LAST_ACTIVE_KEY, String(now))
        lastWrite = now
      }
      arm()
    }

    // 다시 들어왔을 때: 마지막 활동으로부터 이미 30분 지났으면 바로 로그아웃
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0)
    if (last && Date.now() - last > idleMs) {
      onIdle()
      return undefined
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    onActivity() // 마운트 시점부터 세기 시작

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [enabled, onIdle, idleMs])
}
