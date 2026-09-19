import { useState } from 'react'
import { DAY_LABELS, dateKey } from '../../service/matchService'
import styles from './SlotCalendar.module.css'

// 날짜 달력: 오늘부터 maxDays 안의 날짜만 고를 수 있다. 날짜를 탭하면 onPick(date).
// disabledDates: 달력에서 막을 날짜 키('YYYY-MM-DD') 목록 (선택)
function SlotCalendar({ pickedDates, disabledDates = [], onPick, maxDays = 28 }) {
  const today = startOfDay(new Date())
  const last = addDays(today, maxDays - 1)
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const canPrev = new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1)
  const canNext = new Date(year, month + 1, 1) <= last

  const cells = []
  for (let i = 0; i < firstDay; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d))

  return (
    <div className={styles.cal}>
      <div className={styles.head}>
        <button type="button" className={styles.navBtn} onClick={() => setCursor(new Date(year, month - 1, 1))} disabled={!canPrev} aria-label="이전 달">
          ‹
        </button>
        <span className={styles.month}>
          {year}년 {month + 1}월
        </span>
        <button type="button" className={styles.navBtn} onClick={() => setCursor(new Date(year, month + 1, 1))} disabled={!canNext} aria-label="다음 달">
          ›
        </button>
      </div>
      <div className={styles.grid}>
        {DAY_LABELS.map((d) => (
          <span key={d} className={styles.dow}>
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />
          const key = dateKey(date)
          const outOfRange = date < today || date > last
          const shownAsChip = disabledDates.includes(key)
          const on = pickedDates.includes(key)
          const disabled = outOfRange || shownAsChip
          return (
            <button
              key={key}
              type="button"
              className={on ? styles.dayOn : styles.day}
              disabled={disabled}
              onClick={() => onPick(date)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
      <p className={styles.note}>오늘부터 {maxDays}일 안에서 고를 수 있어요</p>
    </div>
  )
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default SlotCalendar
