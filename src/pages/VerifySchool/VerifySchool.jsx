import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { requestSchoolCode, verifySchoolCode } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { nextRouteFor } from '../../utils'
import styles from './VerifySchool.module.css'

// 학교 인증: 대학 이메일 입력 → 인증 코드 확인 → 학교·전공 확정
// 카카오/이메일 어느 쪽으로 가입했든 매칭 전에 반드시 거친다.
function VerifySchool() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [step, setStep] = useState(1)
  const [univEmail, setUnivEmail] = useState('')
  const [code, setCode] = useState('')
  const [school, setSchool] = useState('')
  const [major, setMajor] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 이미 인증된 계정이 다시 들어오면 통과시키되, 방금 인증을 마친 경우(step 3)는 완료 화면을 보여준다
  if (user.schoolVerified && step !== 3) return <Navigate to={nextRouteFor(user)} replace />

  const run = async (fn) => {
    setError('')
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      const { school: guessed } = await requestSchoolCode(user.id, univEmail)
      setSchool(guessed ?? '')
      setStep(2)
    })

  const confirm = () =>
    run(async () => {
      if (!school.trim()) throw new Error('학교명을 입력해줘')
      if (!major.trim()) throw new Error('전공을 입력해줘')
      const updated = await verifySchoolCode(user.id, { univEmail, code, school: school.trim(), major: major.trim() })
      updateUser(updated)
      setStep(3)
    })

  return (
    <Layout step={Math.min(step, 2)} totalSteps={2}>
      {error && <Notice tone="error">{error}</Notice>}

      {step === 1 && (
        <>
          <Heading sub="대학(원)생만 이용할 수 있어서, 학교 이메일로 확인할게">{'학교 인증이\n필요해요'}</Heading>
          <div className={styles.who}>
            {user.provider === 'kakao' ? '💬 카카오' : '✉️ 이메일'} 계정 · {user.name}
          </div>
          <Field label="대학 이메일" hint=".ac.kr 또는 .edu 로 끝나는 학교 메일">
            <Input
              type="email"
              value={univEmail}
              onChange={(e) => setUnivEmail(e.target.value)}
              placeholder="you@univ.ac.kr"
            />
          </Field>
          <Button onClick={sendCode} disabled={loading || !univEmail}>
            {loading ? '보내는 중…' : '인증 코드 받기'}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <Heading sub={`${univEmail}로 보낸 6자리 코드를 입력해줘`}>인증 코드 확인</Heading>
          <Notice>테스트 모드에서는 코드가 항상 123456이에요</Notice>
          <Field label="인증 코드">
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </Field>
          <Field label="학교" hint={school ? '이메일 도메인으로 자동 입력했어. 다르면 고쳐줘' : '도메인으로 학교를 찾지 못했어. 직접 입력해줘'}>
            <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="한양대학교" />
          </Field>
          <Field label="전공">
            <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="컴퓨터공학" />
          </Field>
          <Button onClick={confirm} disabled={loading || code.length !== 6}>
            {loading ? '확인 중…' : '인증 완료하기'}
          </Button>
          <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
            이메일 다시 입력
          </Button>
        </>
      )}

      {step === 3 && (
        <div className={styles.done}>
          <div className={styles.check}>🎓</div>
          <Notice tone="success">학교 인증이 완료됐어요</Notice>
          <Heading sub={`${school} · ${major}`}>인증 완료!</Heading>
          <Button onClick={() => navigate('/test', { replace: true })}>성향 테스트 시작하기</Button>
        </div>
      )}
    </Layout>
  )
}

export default VerifySchool
