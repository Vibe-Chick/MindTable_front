import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice, Textarea } from '../../components/ui/ui'
import { QUESTIONS, analyzeAnswers, checkAnswerQuality, saveProfileVector, validateAnswers } from '../../service/testService'
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

// 심리 테스트: 질문 → 답변 입력 → 모든 답변 완료? → AI 전송 → 추출 결과 유효? → 프로필 저장
function PsychTest() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const { answers, setAnswer, resetTest, profile, setProfile } = useMatch()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('question') // question | analyzing | result | error
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false) // 문항별 품질 검사 중

  const q = QUESTIONS[index]
  const current = answers[q.id] ?? ''
  const canNext = q.type === 'choice' ? Boolean(current) : current.trim().length > 0
  const isLast = index === QUESTIONS.length - 1

  // 부족한 문항으로 되돌리기 (문항별 검사를 통과했더라도 최종 분석에서 걸릴 수 있음)
  const goBackTo = (questionIds, message) => {
    const firstIdx = QUESTIONS.findIndex((x) => questionIds.includes(x.id))
    setIndex(firstIdx >= 0 ? firstIdx : 0)
    setError(message)
    setPhase('question')
  }

  const submit = async () => {
    const pre = validateAnswers(answers)
    if (!pre.ok) {
      goBackTo(pre.insufficient, '이 문항 답변을 조금 더 적어줘야 해')
      return
    }
    setError('')
    setPhase('analyzing')
    try {
      const result = await analyzeAnswers(answers)
      // 추출 결과가 유효하지 않으면 부족한 문항으로 돌아가 재요청 (플로우차트의 "재요청" 분기)
      if (!result.valid) {
        goBackTo(result.insufficient ?? [], 'AI가 이 답변에서 성향을 충분히 읽지 못했어. 조금 더 구체적으로 적어줄래?')
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

  // "다음": 이 문항의 답변 품질을 먼저 검사하고 통과해야 넘어간다
  const next = async () => {
    setError('')
    setChecking(true)
    try {
      const { ok, reason } = await checkAnswerQuality(q, current)
      if (!ok) {
        setError(reason)
        return
      }
      if (isLast) await submit()
      else setIndex(index + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const back = () => {
    setError('')
    setIndex(Math.max(0, index - 1))
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
        <Button
          variant="ghost"
          onClick={() => {
            resetTest()
            setIndex(0)
            setPhase('question')
          }}
        >
          다시 테스트하기
        </Button>
      </Layout>
    )
  }

  return (
    <Layout step={index + 1} totalSteps={QUESTIONS.length}>
      <Heading sub={q.hint}>{q.title}</Heading>

      {q.type === 'open' ? (
        <Textarea
          value={current}
          onChange={(e) => {
            setAnswer(q.id, e.target.value)
            if (error) setError('')
          }}
          placeholder="여기에 자유롭게 적어줘 (10자 이상)"
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
              <span className={styles.emoji}>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.answerError}>⚠️ {error}</p>}

      <div className={styles.spacer} />
      <Button onClick={next} disabled={!canNext || checking}>
        {checking ? '답변 확인 중…' : isLast ? '분석 시작하기' : '다음'}
      </Button>
      {index > 0 && (
        <Button variant="ghost" onClick={back}>
          이전 질문
        </Button>
      )}
    </Layout>
  )
}

export default PsychTest
