import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { requestPasswordCode, resetPassword, verifyPasswordCode } from '../../service/authService'
import { isValidPassword } from '../../utils'

// 가입 이메일 입력 → 인증 코드 발송/확인 → 새 비밀번호 입력 → 변경 완료
function FindPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await requestPasswordCode(email)
      setStep(2)
    })

  const verify = () =>
    run(async () => {
      await verifyPasswordCode(email, code)
      setStep(3)
    })

  const change = () =>
    run(async () => {
      if (!isValidPassword(password)) throw new Error('영문+숫자 포함 8자 이상이어야 해')
      await resetPassword(email, password)
      setStep(4)
    })

  return (
    <Layout showBack={step < 4} step={Math.min(step, 3)} totalSteps={3}>
      {error && <Notice tone="error">{error}</Notice>}

      {step === 1 && (
        <>
          <Heading sub="가입할 때 쓴 이메일로 인증 코드를 보낼게">비밀번호 찾기</Heading>
          <Field label="가입 이메일">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@univ.ac.kr" />
          </Field>
          <Button onClick={sendCode} disabled={loading || !email}>
            {loading ? '보내는 중…' : '인증 코드 받기'}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <Heading sub={`${email}로 보낸 6자리 코드를 입력해줘`}>인증 코드 확인</Heading>
          <Notice>테스트 모드에서는 코드가 항상 123456이에요</Notice>
          <Field label="인증 코드">
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
          </Field>
          <Button onClick={verify} disabled={loading || code.length !== 6}>
            {loading ? '확인 중…' : '확인'}
          </Button>
          <Button variant="ghost" onClick={sendCode} disabled={loading}>
            코드 다시 보내기
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <Heading sub="영문 + 숫자 포함 8자 이상">새 비밀번호 입력</Heading>
          <Field label="새 비밀번호">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button onClick={change} disabled={loading || !password}>
            {loading ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </>
      )}

      {step === 4 && (
        <>
          <Notice tone="success">비밀번호가 변경됐어요</Notice>
          <Heading sub="새 비밀번호로 로그인해줘">변경 완료!</Heading>
          <Button onClick={() => navigate('/login', { replace: true })}>로그인하러 가기</Button>
        </>
      )}
    </Layout>
  )
}

export default FindPassword
