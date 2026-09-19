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

// 숫자 대신 말로: 현재 수준 + 처음 대비 변화
function level(v) {
  if (v >= 4) return '높은 편'
  if (v >= 2.5) return '보통'
  return '낮은 편'
}

function changeText(d) {
  if (d >= 0.5) return { text: '많이 올랐어요', tone: 'up' }
  if (d > 0) return { text: '조금 올랐어요', tone: 'up' }
  if (d <= -0.5) return { text: '많이 내려갔어요', tone: 'down' }
  if (d < 0) return { text: '조금 내려갔어요', tone: 'down' }
  return { text: '그대로예요', tone: 'zero' }
}

function diversityText(p) {
  if (p >= 0.6) return '다른 배경을 선호'
  if (p <= 0.4) return '비슷한 사람을 선호'
  return '둘 다 괜찮아요'
}

// 마이페이지 "통계 · 기록" 탭: 내 프로필(말로 표현) + 테이블 리뷰 기록
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
  // 현재 프로필 = 첫 테스트 + 리뷰 델타 누적
  const current = Object.fromEntries(
    TRAITS.map(([k]) => [k, Math.min(5, Math.max(1, initial[k] + list.reduce((s, r) => s + (r.deltas?.[k] ?? 0), 0)))]),
  )
  const diversity = list[0]?.diversityPref ?? 0.5
  const people = matches.reduce((s, m) => s + (m.groupSize - 1), 0)

  return (
    <>
      <p className={styles.summary}>
        {matches.length > 0 ? `지금까지 ${matches.length}번 만나서 ${people}명과 밥을 먹었어요` : '아직 매칭 기록이 없어요'}
      </p>

      <h3 className={styles.section}>
        내 프로필 <small>{list.length ? '첫 테스트 → 지금' : '첫 테스트 결과'}</small>
      </h3>
      <div className={styles.grid}>
        {TRAITS.map(([k, label]) => {
          const c = changeText(current[k] - initial[k])
          return (
            <div key={k} className={styles.cell}>
              <div className={styles.cellTop}>
                <span>{label}</span>
                <b>{level(current[k])}</b>
              </div>
              {list.length > 0 && <div className={styles[`change_${c.tone}`]}>{c.tone === 'up' ? '▲' : c.tone === 'down' ? '▼' : '—'} {c.text}</div>}
            </div>
          )
        })}
        <div className={styles.cell}>
          <div className={styles.cellTop}>
            <span>다양성</span>
            <b>{diversityText(diversity)}</b>
          </div>
          {list.length > 0 && <div className={styles.change_zero}>최근 리뷰 기준</div>}
        </div>
      </div>

      <h3 className={styles.section}>
        테이블 리뷰 <small>{list.length ? `${list.length}회` : ''}</small>
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
        // 크게 움직인 축 최대 2개만 태그로
        const tags = Object.entries(r.deltas ?? {})
          .filter(([, d]) => Math.abs(d) >= 0.2)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, 2)
        return (
          <button key={r.matchId} type="button" className={styles.review} onClick={() => navigate(`/review/${r.matchId}`)}>
            <span className={styles.reviewIcon}>🍽️</span>
            <span className={styles.reviewText}>
              <b>{r.restaurant}</b>
              <small>{formatDate(r.date)}</small>
              <span className={styles.tags}>
                {tags.map(([k, d]) => (
                  <span key={k} className={d > 0 ? styles.tagUp : styles.tagDown}>
                    {TRAITS.find(([key]) => key === k)?.[1]} {d > 0 ? '↑' : '↓'}
                  </span>
                ))}
                {r.driftAlert && <span className={styles.tagEvent}>⚡ 큰 변화</span>}
              </span>
            </span>
            <span className={styles.arrow}>›</span>
          </button>
        )
      })}
    </>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default ProfileHistory
