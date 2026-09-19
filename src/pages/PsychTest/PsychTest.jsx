import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice, Textarea } from '../../components/ui/ui'
import { QUESTION_COUNT, QUESTION_HINT, analyzeAnswers, checkAnswerQuality, generateQuestion, saveProfileVector, validateAnswers } from '../../service/testService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import { updateProfile } from '../../service/authService'
import styles from './PsychTest.module.css'

const TRAIT_LABEL = {
  openness: '개방성',
  conscientiousness: '성실성',
  extraversion: '외향성',
  agreeableness: '우호성',
  neuroticism: '신경성',
}

// 심리 테스트: 질문 생성 → 답변 입력 → 검증(애매하면 꼬리 질문) → 모든 답변 완료? → AI 전송 → 추출 결과 유효? → 프로필 저장
function PsychTest() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const { answers, setAnswer, resetTest, profile, setProfile } = useMatch()
  // 백엔드가 문항마다 생성해 준 질문. { id: 'q1', type: 'open', title } — id 는 프론트 state 키로만 쓴다
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | question | analyzing | result
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false) // 문항별 품질 검사 중
  // 꼬리 질문: 검증 결과가 애매하면 같은 화면에서 한 번 더 묻는다 (문항당 1개)
  const [followUp, setFollowUp] = useState(null) // { questionId, question } | null
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [followUps, setFollowUps] = useState([]) // [{ questionId, question, answer }] → analyze 에 함께 전송
  // 진행 표시: 기본 질문 3개 + 꼬리 질문이 생기면 4번째로 카운트
  const extraStep = followUps.length + (followUp ? 1 : 0)

  // i 번째 질문 생성 (없을 때만). 진입 시 · 다음 문항으로 넘어갈 때 · 다시 테스트하기
  const fetchQuestion = (i) =>
    generateQuestion(i)
      .then((title) => {
        setQuestions((prev) => {
          const next = [...prev]
          next[i] = { id: `q${i + 1}`, type: 'open', title }
          return next
        })
        setPhase('question')
      })
      .catch((err) => setError(err.message))
  const load = () => {
    setError('')
    setPhase('loading')
    return fetchQuestion(0)
  }
  useEffect(() => {
    fetchQuestion(0)
  }, [])

  const q = questions?.[index]
  const current = q ? (answers[q.id] ?? '') : ''
  const canNext = followUp
    ? followUpAnswer.trim().length > 0
    : q?.type === 'choice'
      ? Boolean(current)
      : current.trim().length > 0
  const isLast = index === QUESTION_COUNT - 1

  // 부족한 문항으로 되돌리기 (문항별 검사를 통과했더라도 최종 분석에서 걸릴 수 있음)
  const goBackTo = (questionIds, message) => {
    const firstIdx = questions.findIndex((x) => questionIds.includes(x.id))
    setIndex(firstIdx >= 0 ? firstIdx : 0)
    setFollowUp(null)
    setFollowUpAnswer('')
    setError(message)
    setPhase('question')
  }

  const submit = async (allFollowUps) => {
    const pre = validateAnswers(questions, answers)
    if (!pre.ok) {
      goBackTo(pre.insufficient, '이 문항 답변을 조금 더 적어줘야 해')
      return
    }
    setError('')
    setPhase('analyzing')
    try {
      // 기본 답변은 check-answer 때 백엔드가 저장 → 여기선 user_id(이메일)와 꼬리 질문만 보낸다
      const result = await analyzeAnswers(
        user.email,
        allFollowUps,
        questions.map((x) => ({ question: x.title, answer: answers[x.id] })), // mock 계산용
      )
      // 추출 결과가 유효하지 않으면 부족한 문항으로 돌아가 재요청 (insufficient: 문항 index 또는 id)
      if (!result.valid) {
        const ids = (result.insufficient ?? []).map((v) => (typeof v === 'number' ? `q${v + 1}` : v))
        goBackTo(ids, 'AI가 이 답변에서 성향을 충분히 읽지 못했어. 조금 더 구체적으로 적어줄래?')
        return
      }
      await saveProfileVector(user.id, result)
      await updateProfile(user.id, { hasProfile: true })
      updateUser({ hasProfile: true })
      setProfile(result)
      setPhase('result')
    } catch (err) {
      setError(err.message)
      setPhase('question')
    }
  }

  const advance = async (allFollowUps) => {
    if (isLast) {
      await submit(allFollowUps)
      return
    }
    setIndex(index + 1)
    // 다음 질문이 아직 없으면 생성 (이전 질문으로 돌아갔다 온 경우엔 있음)
    if (!questions[index + 1]) {
      setPhase('loading')
      await fetchQuestion(index + 1)
    }
  }

  // "다음": 이 문항의 답변 품질을 먼저 검사하고 통과해야 넘어간다
  // 꼬리 질문이 떠 있으면 그 답변을 모아두고 (재검증 없이) 넘어간다
  const next = async () => {
    setError('')
    if (followUp) {
      const nextFollowUps = [...followUps, { ...followUp, answer: followUpAnswer.trim() }]
      setFollowUps(nextFollowUps)
      setFollowUp(null)
      setFollowUpAnswer('')
      await advance(nextFollowUps)
      return
    }
    setChecking(true)
    try {
      const { ok, reason, followUpQuestion } = await checkAnswerQuality(q, current)
      if (!ok) {
        setError(reason)
        return
      }
      // 꼬리 질문은 테스트당 1개까지 (4번째 문항). 이미 받았으면 그냥 넘어간다
      if (followUpQuestion && followUps.length === 0) {
        setFollowUp({ questionId: q.id, question: followUpQuestion })
        return
      }
      await advance(followUps)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const back = () => {
    setError('')
    if (followUp) {
      // 꼬리 질문에서 뒤로 → 원래 답변 수정
      setFollowUp(null)
      setFollowUpAnswer('')
      return
    }
    setIndex(Math.max(0, index - 1))
  }

  const restart = () => {
    resetTest()
    setQuestions([])
    setFollowUps([])
    setFollowUp(null)
    setFollowUpAnswer('')
    setIndex(0)
    load()
  }

  if (phase === 'loading') {
    return (
      <Layout>
        <div className={styles.center}>
          {error ? (
            <>
              <Notice tone="error">{error}</Notice>
              <Button onClick={load}>다시 시도</Button>
            </>
          ) : (
            <>
              <div className={styles.spinner} />
              <Heading sub={index === 0 ? '너한테 맞는 질문을 만드는 중이에요' : `${index + 1}번째 질문을 만드는 중이에요`}>{'질문을\n준비하고 있어요'}</Heading>
            </>
          )}
        </div>
      </Layout>
    )
  }

  if (phase === 'analyzing') {
    return (
      <Layout>
        <div className={styles.center}>
          <div className={styles.spinner} />
          <Heading sub="답변을 읽고 Big Five 성향과 관심사를 뽑는 중이에요">
            {'AI가 성향을\n분석하고 있어요'}
          </Heading>
        </div>
      </Layout>
    )
  }

  if (phase === 'result' && profile) {
    return (
      <Layout>
        <Notice tone="success">프로필이 저장됐어요</Notice>
        <Heading sub={profile.summary}>{'테스트 완료!\n이런 사람이구나'}</Heading>

        <div className={styles.traits}>
          {Object.entries(profile.bigFive).map(([key, score]) => (
            <div key={key} className={styles.trait}>
              <span className={styles.traitName}>{TRAIT_LABEL[key]}</span>
              <div className={styles.traitBar}>
                <div className={styles.traitFill} style={{ width: `${(score / 5) * 100}%` }} />
              </div>
              <span className={styles.traitScore}>{score}</span>
            </div>
          ))}
        </div>

        <div className={styles.tags}>
          {profile.interests.map((t) => (
            <span key={t} className={styles.tag}>
              #{t}
            </span>
          ))}
        </div>

        <div className={styles.spacer} />
        <Button onClick={() => navigate('/home', { replace: true })}>매칭 받으러 가기</Button>
        <Button variant="ghost" onClick={restart}>
          다시 테스트하기
        </Button>
      </Layout>
    )
  }

  return (
    <Layout step={index + 1 + extraStep} totalSteps={QUESTION_COUNT + extraStep}>
      {followUp ? (
        <>
          <div className={styles.prevAnswer}>
            <span className={styles.prevLabel}>내 답변</span>
            {current}
          </div>
          <Heading sub="AI가 한 가지만 더 물어볼게. 짧게 답해도 괜찮아">{followUp.question}</Heading>
          <Textarea
            value={followUpAnswer}
            onChange={(e) => {
              setFollowUpAnswer(e.target.value)
              if (error) setError('')
            }}
            placeholder="여기에 편하게 적어줘"
            className={styles.followUpArea}
          />
        </>
      ) : (
        <>
          <Heading sub={QUESTION_HINT}>{q.title}</Heading>

          {q.type === 'open' ? (
            <Textarea
              value={current}
              onChange={(e) => {
                setAnswer(q.id, e.target.value)
                if (error) setError('')
              }}
              placeholder="여기에 자유롭게 적어줘"
              className={error ? styles.textareaInvalid : ''}
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
                  {opt.emoji && <span className={styles.emoji}>{opt.emoji}</span>}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className={styles.answerError}>⚠️ {error}</p>}

      <div className={styles.spacer} />
      <Button onClick={next} disabled={!canNext || checking}>
        {checking ? '답변 확인 중…' : isLast ? '분석 시작하기' : '다음'}
      </Button>
      {(index > 0 || followUp) && (
        <Button variant="ghost" onClick={back}>
          {followUp ? '원래 답변 고치기' : '이전 질문'}
        </Button>
      )}
    </Layout>
  )
}

export default PsychTest
