import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice } from '../../components/ui/ui'
import { getMatchResult, requestMatch, upcomingSlots } from '../../service/matchService'
import { notifyLocal } from '../../service/pushService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import styles from './Matching.module.css'

// 매칭 파이프라인 단계 (백엔드 플로우를 사용자에게 보여주는 로딩 화면)
const STEPS = [
  '대기자 풀 조회 중…',
  '성격(Big Five) 유사도 계산 중…',
  '전공 · 학교 다양성 점수 계산 중…',
  '최적 그룹 구성 중…',
  '매칭 이유 · 아이스브레이커 생성 중…',
]

function Matching() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setMatch } = useMatch()
  const [doneSteps, setDoneSteps] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  // 희망 시간대 선택 단계 ("정해진 배치 시각" 트리거). 'now'면 즉시 매칭
  const [slots] = useState(() => upcomingSlots())
  const [picked, setPicked] = useState([])
  const [started, setStarted] = useState(false)

  const togglePick = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  useEffect(() => {
    if (!started) return undefined
    let cancelled = false
    const timers = STEPS.map((_, i) => setTimeout(() => !cancelled && setDoneSteps(i + 1), 600 * (i + 1)))

    ;(async () => {
      try {
        const { matchId } = await requestMatch(user.id, picked.length ? picked : ['now'])
        const { result } = await getMatchResult(matchId)
        if (cancelled) return
        setMatch(result)
        notifyLocal({ type: 'match_done', title: '✨ 매칭이 완료됐어요', body: `${result.members.map((m) => m.name).join(' · ')} — 다른 전공 · 다른 학교 조합이에요`, url: '/matching/result' })
        setDoneSteps(STEPS.length)
        setReady(true)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  if (!started) {
    return (
      <Layout title="매칭 신청" showBack>
        <Heading sub="같은 시간대를 고른 사람들끼리 묶여요. 여러 개 골라도 돼">{'이번 주 언제\n밥 먹을 수 있어?'}</Heading>
        <div className={styles.slots}>
          {slots.map((s) => (
            <button
              key={s.id}
              type="button"
              className={picked.includes(s.id) ? styles.slotOn : styles.slot}
              onClick={() => togglePick(s.id)}
            >
              {s.meal === 'lunch' ? '🌤' : '🌙'} {s.label}
            </button>
          ))}
        </div>
        <p className={styles.slotHint}>
          {picked.length ? `${picked.length}개 선택 · 가장 빠른 시간대로 매칭돼요` : '고르지 않으면 지금 바로 매칭을 시도해요'}
        </p>
        <div className={styles.spacer} />
        <Button onClick={() => setStarted(true)}>{picked.length ? '이 시간대로 매칭 신청' : '지금 바로 매칭'}</Button>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={styles.center}>
        {!ready && !error && <div className={styles.spinner} />}
        {ready && <div className={styles.check}>✓</div>}
        <Heading sub="조금만 기다려줘, 곧 만나게 될 사람들이 있어">
          {ready ? '매칭이 완료됐어요!' : 'AI가 성향을 분석하고\n어울리는 그룹을 찾고 있어요'}
        </Heading>

        {error && <Notice tone="error">{error}</Notice>}

        <ul className={styles.steps}>
          {STEPS.map((label, i) => (
            <li key={label} className={i < doneSteps ? styles.stepDone : styles.step}>
              <span className={styles.stepIcon}>{i < doneSteps ? '✓' : '·'}</span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <Button onClick={() => navigate('/matching/result', { replace: true })} disabled={!ready}>
        매칭 결과 보러가기
      </Button>
    </Layout>
  )
}

export default Matching
