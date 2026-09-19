import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice, Textarea } from '../../components/ui/ui'
import { QUESTIONS, analyzeAnswers, saveProfileVector, validateAnswers } from '../../service/testService'
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

  const q = QUESTIONS[index]
  const current = answers[q.id] ?? ''
  const canNext = q.type === 'choice' ? Boolean(current) : current.trim().length >= 10
  const isLast = index === QUESTIONS.length - 1

  const submit = async () => {
    if (!validateAnswers(answers)) {
      setError('답변이 너무 짧은 문항이 있어. 조금만 더 적어줄래?')
      setIndex(0)
      return
    }
    setError('')
    setPhase('analyzing')
    try {
      const result = await analyzeAnswers(answers)
      // 추출 결과가 유효하지 않으면 재요청 (플로우차트의 "재요청" 분기)
      if (!result.valid) {
        setError('AI가 성향을 충분히 파악하지 못했어. 답변을 조금 더 구체적으로 적어줄래?')
        setPhase('question')
        setIndex(0)
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

  const next = () => {
    if (isLast) submit()
    else setIndex(index + 1)
  }

  const back = () => setIndex(Math.max(0, index - 1))

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
      {error && <Notice tone="error">{error}</Notice>}
      <Heading sub={q.hint}>{q.title}</Heading>

      {q.type === 'open' ? (
        <Textarea
          value={current}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          placeholder="여기에 자유롭게 적어줘 (10자 이상)"
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

      <div className={styles.spacer} />
      <Button onClick={next} disabled={!canNext}>
        {isLast ? '분석 시작하기' : '다음'}
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
