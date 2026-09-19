import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice } from '../../components/ui/ui'
import { dateKey, getMatchResult, requestMatch, slotsForDate, upcomingSlots } from '../../service/matchService'
import SlotCalendar from './SlotCalendar'
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
  // 같은 학교끼리만 매칭 — 학교 인증한 사용자에게만 보이는 옵션 (기본은 다른 학교 포함)
  const [sameSchoolOnly, setSameSchoolOnly] = useState(false)
  const [started, setStarted] = useState(false)
  // 달력에서 추가한 날짜의 슬롯 (7일 칩 밖의 날짜). 보내는 값은 같은 slots id 형식이라 API 는 그대로
  const [calOpen, setCalOpen] = useState(false)
  const [extraSlots, setExtraSlots] = useState([])

  const togglePick = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // 달력에서 날짜 탭: 그 날짜의 점심/저녁 칩을 추가 (다시 탭하면 제거 + 선택 해제)
  const pickDate = (date) => {
    const key = dateKey(date)
    const has = extraSlots.some((s) => s.id.startsWith(key))
    if (has) {
      setExtraSlots((prev) => prev.filter((s) => !s.id.startsWith(key)))
      setPicked((prev) => prev.filter((id) => !id.startsWith(key)))
    } else {
      setExtraSlots((prev) => [...prev, ...slotsForDate(date)].sort((a, b) => a.at.localeCompare(b.at)))
    }
  }
  const chipDates = [...new Set(slots.map((s) => s.id.slice(0, 10)))]
  const extraDates = [...new Set(extraSlots.map((s) => s.id.slice(0, 10)))]

  useEffect(() => {
    if (!started) return undefined
    let cancelled = false
    const timers = STEPS.map((_, i) => setTimeout(() => !cancelled && setDoneSteps(i + 1), 600 * (i + 1)))

    ;(async () => {
      try {
        const { matchId } = await requestMatch(user.id, picked.length ? picked : ['now'], { sameSchoolOnly, school: user.school })
        const { result } = await getMatchResult(matchId)
        if (cancelled) return
        setMatch(result)
        notifyLocal({
          type: 'match_done',
          title: '✨ 매칭이 완료됐어요',
          body: `${result.members.map((m) => m.name).join(' · ')} — ${sameSchoolOnly ? '같은 학교 · 다른 전공' : '다른 전공 · 다른 학교'} 조합이에요`,
          url: '/matching/result',
        })
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
        {extraSlots.length > 0 && (
          <>
            <p className={styles.extraLabel}>달력에서 추가한 날짜</p>
            <div className={styles.slots}>
              {extraSlots.map((s) => (
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
          </>
        )}
        <button type="button" className={styles.calToggle} onClick={() => setCalOpen((v) => !v)}>
          📅 {calOpen ? '달력 닫기' : '다른 날짜 고르기'}
        </button>
        {calOpen && <SlotCalendar pickedDates={extraDates} disabledDates={chipDates} onPick={pickDate} />}
        <p className={styles.slotHint}>
          {picked.length ? `${picked.length}개 선택 · 가장 빠른 시간대로 매칭돼요` : '고르지 않으면 지금 바로 매칭을 시도해요'}
        </p>

        {user.schoolVerified && (
          <label className={styles.option}>
            <span>
              🎓 같은 학교끼리만
              <small>{sameSchoolOnly ? `${user.school} 인증 학생들과만 만나요` : '끄면 다른 학교 학생과도 만나요'}</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={sameSchoolOnly}
              aria-label="같은 학교끼리만 매칭"
              className={sameSchoolOnly ? styles.toggleOn : styles.toggle}
              onClick={() => setSameSchoolOnly((v) => !v)}
            />
          </label>
        )}
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
