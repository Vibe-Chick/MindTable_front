import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReviewHistory } from '../../service/reviewService'
import { getMatchHistory } from '../../service/matchService'
import { loadJson } from '../../utils'
import styles from './ProfileHistory.module.css'

const TRAITS = [
  ['openness', '개방성'],
  ['conscientiousness', '성실성'],
  ['extraversion', '외향성'],
  ['agreeableness', '우호성'],
  ['neuroticism', '신경성'],
]

const DEFAULT_BIGFIVE = { openness: 3, conscientiousness: 3, extraversion: 3, agreeableness: 3, neuroticism: 3 }

function changeText(d) {
  const v = Math.abs(d).toFixed(1)
  if (d > 0) return { text: `▲ ${v} 올랐어요`, tone: 'up' }
  if (d < 0) return { text: `▼ ${v} 낮아졌어요`, tone: 'down' }
  return { text: '— 그대로', tone: 'zero' }
}

function diversityChange(series) {
  const d = series[series.length - 1] - series[0]
  if (d > 0.05) return { text: '▲ 다른 배경 쪽으로', tone: 'up' }
  if (d < -0.05) return { text: '▼ 비슷한 사람 쪽으로', tone: 'down' }
  return { text: '— 그대로', tone: 'zero' }
}

// 마이페이지 "통계 · 기록" 탭: 통계 3칸 + 내 프로필(추이선 + 숫자) + 테이블 리뷰 기록
function ProfileHistory({ userId }) {
  const navigate = useNavigate()
  const [reviews, setReviews] = useState(null)
  const [matches, setMatches] = useState([])

  useEffect(() => {
    getReviewHistory(userId).then(setReviews)
    getMatchHistory(userId).then(setMatches)
  }, [userId])

  const initial = loadJson('mt_profile')?.bigFive ?? DEFAULT_BIGFIVE
  const list = reviews ?? []
  const asc = [...list].sort((a, b) => new Date(a.date) - new Date(b.date))

  // 축별 추이: 첫 테스트 → 리뷰마다 델타 누적
  const series = Object.fromEntries(
    TRAITS.map(([k]) => {
      const pts = [initial[k]]
      asc.forEach((r) => pts.push(Math.min(5, Math.max(1, pts[pts.length - 1] + (r.deltas?.[k] ?? 0)))))
      return [k, pts]
    }),
  )
  const diversitySeries = [0.5, ...asc.map((r) => r.diversityPref ?? 0.5)]
  const people = matches.reduce((s, m) => s + (m.groupSize - 1), 0)

  const rows = [
    ...TRAITS.map(([k, label]) => {
      const s = series[k]
      return { key: k, label, series: s, min: 1, max: 5, value: s[s.length - 1].toFixed(1), change: changeText(s[s.length - 1] - s[0]) }
    }),
    { key: 'diversity', label: '다양성', series: diversitySeries, min: 0, max: 1, value: `${Math.round(diversitySeries[diversitySeries.length - 1] * 100)}`, unit: '%', change: diversityChange(diversitySeries) },
  ]

  return (
    <>
      <div className={styles.stats}>
        <div>
          <b className={styles.statNum}>{matches.length}</b>
          <span>총 매칭</span>
        </div>
        <div>
          <b className={styles.statNum}>{people}</b>
          <span>만난 사람</span>
        </div>
        <div>
          <b className={styles.statNum}>{list.length}</b>
          <span>리뷰</span>
        </div>
      </div>

      <h3 className={styles.section}>
        내 프로필 <small>{list.length ? '첫 테스트 → 지금' : '첫 테스트 결과'}</small>
      </h3>
      <div className={styles.rows}>
        {rows.map((r, i) => (
          <div key={r.key} className={styles.row}>
            <span className={styles.idx}>{String(i + 1).padStart(2, '0')}</span>
            <span className={styles.name}>
              <b>{r.label}</b>
              {list.length > 0 && <small className={styles[`tone_${r.change.tone}`]}>{r.change.text}</small>}
            </span>
            <Sparkline series={r.series} min={r.min} max={r.max} tone={list.length ? r.change.tone : 'zero'} value={r.value} unit={r.unit} />
          </div>
        ))}
      </div>

      <div className={styles.reviewsWrap}>
        <h3 className={styles.section}>
          리뷰 기록 <small>{list.length ? `${list.length}회` : ''}</small>
        </h3>
        {reviews === null && <p className={styles.empty}>불러오는 중…</p>}
        {reviews !== null && list.length === 0 && (
          <p className={styles.empty}>
            식사 후 테이블 리뷰를 남기면 프로필이 조금씩 나에게 맞춰져요.
            <br />
            첫 매칭을 신청해봐!
          </p>
        )}
        {list.map((r) => {
          const tags = Object.entries(r.deltas ?? {})
            .filter(([, d]) => Math.abs(d) >= 0.2)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 2)
          return (
            <button key={r.matchId} type="button" className={styles.review} onClick={() => navigate(`/review/${r.matchId}`)}>
              <span className={styles.reviewIcon}>🍽️</span>
              <span className={styles.reviewText}>
                <span className={styles.reviewHead}>
                  <b>{r.restaurant}</b>
                  {r.driftAlert && <span className={styles.tagEvent}>프로필 이동</span>}
                </span>
                <small>
                  {formatDate(r.date)}
                  {r.members ? ` · ${r.members}` : ''}
                </small>
                <span className={styles.tags}>
                  {tags.map(([k, d]) => (
                    <span key={k} className={d > 0 ? styles.tagUp : styles.tagDown}>
                      {TRAITS.find(([key]) => key === k)?.[1]} {d > 0 ? '↑' : '↓'}
                    </span>
                  ))}
                </span>
              </span>
              <span className={styles.arrow}>›</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// 추이선: 방향별 색(오름 초록 / 내림 코랄 / 그대로 회색) + 아래쪽 그라데이션 채움
// 끝점에 값 레이블(코랄 알약)을 붙여 차트 데이터 레이블처럼 보이게 한다
function Sparkline({ series, min, max, tone, value, unit }) {
  const W = 150
  const H = 34
  const LABEL_W = unit ? 40 : 34
  const PLOT_W = W - LABEL_W - 6 // 레이블 자리를 비워둔 선 영역
  const color = tone === 'down' ? '#e5533c' : tone === 'zero' ? '#9c9c9c' : '#2f9e6b'
  const pts = series.length === 1 ? [series[0], series[0]] : series
  const x = (i) => 4 + (i / (pts.length - 1)) * (PLOT_W - 8)
  const y = (v) => 7 + (1 - (v - min) / (max - min)) * (H - 14)
  const line = pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const lastX = x(pts.length - 1)
  const lastY = y(pts[pts.length - 1])
  const id = `sp-${tone}-${Math.round(lastY)}-${pts.length}`
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={`4,${H} ${line} ${lastX},${H}`} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={line} />
      <circle cx={lastX} cy={lastY} r="3.2" fill={color} stroke="#fff" strokeWidth="1.5" />
      {/* 값 레이블: 끝점 오른쪽, 끝점 높이에 맞춤 */}
      <g transform={`translate(${lastX + 6}, ${lastY})`}>
        <rect x="0" y="-9" width={LABEL_W} height="18" rx="9" fill="#ff6b52" />
        <text x={LABEL_W / 2} y="0" textAnchor="middle" dominantBaseline="central" className={styles.labelText}>
          {value}
          {unit}
        </text>
      </g>
    </svg>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`
}

export default ProfileHistory
