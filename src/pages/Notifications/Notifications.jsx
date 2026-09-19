import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { NOTIFICATION_TYPES } from '../../service/notificationService'
import { useNotifications } from '../../store/NotificationContext'
import styles from './Notifications.module.css'

// 알림 센터: 매칭 완료 · 장소 확정 · 리뷰 요청 등을 시간순으로 보여주고, 탭하면 해당 화면으로 이동
function Notifications() {
  const navigate = useNavigate()
  const { items, unreadCount, read, readAll } = useNotifications()

  const open = async (n) => {
    if (!n.read) read(n.id)
    const meta = NOTIFICATION_TYPES[n.type]
    if (meta) navigate(meta.to(n))
  }

  const groups = groupByDay(items)

  const right = unreadCount > 0 && (
    <button type="button" className={styles.readAll} onClick={readAll}>
      모두 읽음
    </button>
  )

  return (
    <Layout title="알림" showBack right={right}>
      {items.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🔔</span>
          <p>아직 알림이 없어요</p>
          <small>매칭이 완료되거나 식사 장소가 정해지면 여기서 알려줄게</small>
        </div>
      )}

      {groups.map(([day, list]) => (
        <section key={day} className={styles.group}>
          <h3 className={styles.day}>{day}</h3>
          {list.map((n) => {
            const meta = NOTIFICATION_TYPES[n.type] ?? { icon: '🔔', title: '알림' }
            return (
              <button key={n.id} type="button" className={n.read ? styles.item : styles.itemUnread} onClick={() => open(n)}>
                <span className={styles.icon}>{meta.icon}</span>
                <span className={styles.text}>
                  <strong>{meta.title}</strong>
                  <span>{n.body}</span>
                  <small>{formatTime(n.createdAt)}</small>
                </span>
                {!n.read && <span className={styles.dot} />}
              </button>
            )
          })}
        </section>
      ))}
    </Layout>
  )
}

function groupByDay(items) {
  const map = new Map()
  items.forEach((n) => {
    const key = dayLabel(n.createdAt)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(n)
  })
  return [...map.entries()]
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(d)
}

function formatTime(iso) {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export default Notifications
