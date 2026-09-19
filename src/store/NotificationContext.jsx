import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getNotifications, markAllRead, markRead } from '../service/notificationService'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

// 알림 목록 + 읽지 않은 개수를 전역으로 공유 (메인 벨 배지, 알림 센터)
export function NotificationProvider({ children }) {
  const { isLoggedIn } = useAuth()
  const [items, setItems] = useState([])

  const refresh = useCallback(async () => {
    const list = isLoggedIn ? await getNotifications() : await Promise.resolve([])
    setItems(list)
  }, [isLoggedIn])

  useEffect(() => {
    queueMicrotask(refresh) // 비동기로 호출 (effect 안 동기 setState 방지)
    // mock 알림 생성 시 발생하는 이벤트 + 30초 폴링
    window.addEventListener('mt:notifications', refresh)
    const timer = setInterval(refresh, 30000)
    return () => {
      window.removeEventListener('mt:notifications', refresh)
      clearInterval(timer)
    }
  }, [refresh])

  const read = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await markRead(id)
  }

  const readAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await markAllRead()
  }

  const unreadCount = items.filter((n) => !n.read).length

  const value = { items, unreadCount, refresh, read, readAll }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
