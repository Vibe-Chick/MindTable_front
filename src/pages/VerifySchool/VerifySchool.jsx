import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { requestSchoolCode, verifySchoolCode } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { nextRouteFor } from '../../utils'
import styles from './VerifySchool.module.css'

// 학교 인증(선택): 대학 이메일 입력 → 인증 코드 확인 → 학교·전공 확정
// 인증하지 않아도 로그인은 되지만, 매칭·식당·구독은 인증한 사용자만 이용할 수 있다.
function VerifySchool() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const gated = params.get('reason') === 'gated' // 인증 필요 기능에 접근하다 넘어온 경우
  const { user, updateUser } = useAuth()
  const preset = useLocation().state ?? {} // 로그인 직후 자동 발송된 경우 { univEmail, school, sent }
  const [step, setStep] = useState(preset.sent ? 2 : 1)
  const [univEmail, setUnivEmail] = useState(preset.univEmail ?? '')
  const [code, setCode] = useState('')
  const [school, setSchool] = useState(preset.school ?? '')
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
      {gated && !error && step === 1 && <Notice>이 기능은 학교 인증을 한 사용자만 이용할 수 있어요</Notice>}

      {step === 1 && (
        <>
          <Heading sub="학교 이메일로 확인할게">{'학교 인증하고\n매칭 받기'}</Heading>
          <div className={styles.who}>
            {user.email} · {user.name}
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
          <Button variant="ghost" onClick={() => navigate('/home', { replace: true })} disabled={loading}>
            나중에 할게요
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          {preset.sent && !error && <Notice tone="success">학교 계정으로 로그인해서 인증 코드를 바로 보냈어요</Notice>}
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
          <Button onClick={() => navigate(user.hasProfile ? '/home' : '/test', { replace: true })}>
            {user.hasProfile ? '매칭 받으러 가기' : '성향 테스트 시작하기'}
          </Button>
        </div>
      )}
    </Layout>
  )
}

export default VerifySchool
