import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice, Textarea } from '../../components/ui/ui'
import { checkAnswerLocally } from '../../service/testService'
import { REVIEW_QUESTIONS, getReviewStatus, reviewWindow, submitReview } from '../../service/reviewService'
import { useMatch } from '../../store/MatchContext'
import styles from './Review.module.css'

const TRAIT_LABEL = {
  openness: '개방성',
  conscientiousness: '성실성',
  extraversion: '외향성',
  agreeableness: '우호성',
  neuroticism: '신경성',
}

// 테이블 리뷰 (플로우차트의 '보정' 단계): 식사 완료 → 리뷰 요청 → 4문항 답변 → LLM 델타 추출 → 프로필 보정 결과
function Review() {
  const navigate = useNavigate()
  const { matchId } = useParams()
  const { match, profile, restaurant } = useMatch()
  const [status, setStatus] = useState(null) // null(로딩) | { submitted, result }
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('question') // question | submitting | result
  const [result, setResult] = useState(null)

  useEffect(() => {
    getReviewStatus(matchId).then(setStatus)
  }, [matchId])

  if (!match || match.id !== matchId) return <Navigate to="/home" replace />
  if (!status) return <Layout title="테이블 리뷰" showBack />

  const window = reviewWindow(match.mealAt)

  // 아직 식사 전 → 리뷰 창이 안 열림
  if (window.notYet && !status.submitted) {
    return (
      <Layout title="테이블 리뷰" showBack>
        <div className={styles.center}>
          <div className={styles.expired}>🍽️</div>
          <Heading sub={`${formatMeal(match.mealAt)} 식사가 끝나고 2시간 뒤에 열려요`}>{'아직 식사 전이에요'}</Heading>
          <Button onClick={() => navigate('/home', { replace: true })}>메인으로</Button>
        </div>
      </Layout>
    )
  }

  // 24시간 초과 미제출 → 종료 (이번 회차 델타 0, 다음 매칭 대기로 복귀)
  if (window.expired && !status.submitted) {
    return (
      <Layout title="테이블 리뷰" showBack>
        <div className={styles.center}>
          <div className={styles.expired}>⏰</div>
          <Heading sub="테이블 리뷰는 식사 후 24시간 안에만 남길 수 있어요. 이번 테이블은 프로필 반영 없이 넘어갈게">{'리뷰 기간이\n끝났어요'}</Heading>
          <Button onClick={() => navigate('/home', { replace: true })}>다음 매칭 기다리기</Button>
        </div>
      </Layout>
    )
  }

  // 이미 제출한 리뷰면 결과만 보여준다
  if (status.submitted && phase !== 'result') {
    return <ResultView result={status.result} onDone={() => navigate('/home', { replace: true })} already />
  }

  const q = REVIEW_QUESTIONS[index]
  const current = answers[q.id] ?? ''
  const canNext = q.type === 'choice' ? Boolean(current) : current.trim().length > 0
  const isLast = index === REVIEW_QUESTIONS.length - 1

  const setAnswer = (id, v) => {
    setAnswers((prev) => ({ ...prev, [id]: v }))
    if (error) setError('')
  }

  const next = async () => {
    const { ok, reason } = checkAnswerLocally(q, current)
    if (!ok) {
      setError(reason)
      return
    }
    if (!isLast) {
      setIndex(index + 1)
      return
    }
    setPhase('submitting')
    try {
      const res = await submitReview(matchId, answers, profile?.bigFive)
      setResult(res)
      setPhase('result')
    } catch (err) {
      setError(err.message)
      setPhase('question')
    }
  }

  if (phase === 'submitting') {
    return (
      <Layout>
        <div className={styles.center}>
          <div className={styles.spinner} />
          <Heading sub="오늘 식사에서 드러난 성향 변화를 프로필에 반영하는 중이에요">
            {'리뷰를 읽고\n프로필에 반영하고 있어요'}
          </Heading>
        </div>
      </Layout>
    )
  }

  if (phase === 'result' && result) {
    return <ResultView result={result} onDone={() => navigate('/home', { replace: true })} />
  }

  return (
    <Layout step={index + 1} totalSteps={REVIEW_QUESTIONS.length}>
      {index === 0 && (
        <div className={styles.meal}>
          <span className={styles.mealIcon}>🍽️</span>
          <span>
            <strong>{restaurant?.name ?? '오늘의 식사'}</strong>
            <small>{match.members.map((m) => m.name).join(' · ')}</small>
          </span>
          <span className={styles.deadline}>⏱ {window.hoursLeft === null ? '24시간 내' : `${window.hoursLeft}시간 남음`}</span>
        </div>
      )}

      <Heading sub={q.hint}>{q.title}</Heading>

      {q.type === 'open' ? (
        <Textarea
          value={current}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          placeholder="솔직하게 적어줘"
          className={error ? styles.invalid : ''}
        />
      ) : (
        <div className={styles.choices}>
          {q.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={current === opt.value ? styles.choiceOn : styles.choice}
              onClick={() => setAnswer(q.id, opt.value)}
            >
              <span className={styles.emoji}>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.answerError}>⚠️ {error}</p>}

      <div className={styles.spacer} />
      <Button onClick={next} disabled={!canNext}>
        {isLast ? '테이블 리뷰 남기기' : '다음'}
      </Button>
      {index > 0 ? (
        <Button variant="ghost" onClick={() => setIndex(index - 1)}>
          이전 질문
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => navigate('/home')}>
          나중에 쓸게요
        </Button>
      )}
    </Layout>
  )
}

// 반영 결과: 축별 변화(델타) + 다양성 선호도
function ResultView({ result, onDone, already = false }) {
  const { before, after, deltas, diversityPref, summary, driftAlert } = result
  return (
    <Layout title="테이블 리뷰" showBack>
      <Notice tone="success">{already ? '이미 남긴 테이블 리뷰예요' : '리뷰가 프로필에 반영됐어요'}</Notice>
      <Heading sub={summary}>{'프로필이\n이렇게 바뀌었어요'}</Heading>

      <div className={styles.traits}>
        {Object.keys(after).map((key) => {
          const d = deltas[key] ?? 0
          return (
            <div key={key} className={styles.trait}>
              <span className={styles.traitName}>{TRAIT_LABEL[key]}</span>
              <div className={styles.traitBar}>
                <div className={styles.traitBefore} style={{ width: `${(before[key] / 5) * 100}%` }} />
                <div className={styles.traitAfter} style={{ width: `${(after[key] / 5) * 100}%` }} />
              </div>
              <span className={d > 0 ? styles.deltaUp : d < 0 ? styles.deltaDown : styles.deltaZero}>
                {d > 0 ? `+${d}` : d === 0 ? '—' : d}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.diversity}>
        <div className={styles.diversityHead}>
          <span>다양성 선호도</span>
          <strong>{Math.round(diversityPref * 100)}%</strong>
        </div>
        <div className={styles.diversityBar}>
          <div className={styles.diversityFill} style={{ width: `${diversityPref * 100}%` }} />
        </div>
        <div className={styles.diversityLabels}>
          <span>비슷한 사람</span>
          <span>다른 배경</span>
        </div>
      </div>

      {driftAlert && (
        <Notice>성향이 눈에 띄게 달라졌어요. 다음 매칭부터 업데이트된 프로필로 그룹을 찾을게요</Notice>
      )}

      <div className={styles.spacer} />
      <Button onClick={onDone}>다음 매칭 기다리기</Button>
    </Layout>
  )
}

function formatMeal(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default Review
