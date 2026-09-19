import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { signup } from '../../service/authService'
import { isUniversityEmail, isValidEmail, isValidPassword } from '../../utils'
import styles from './Signup.module.css'

const INITIAL = { email: '', password: '', passwordConfirm: '', name: '', school: '', major: '' }

// 회원 정보 입력 → 유효성 검사(상황별 메시지) → 가입 완료
function validate(form) {
  const errors = {}
  if (!isValidEmail(form.email)) errors.email = '이메일 형식을 확인해줘'
  else if (!isUniversityEmail(form.email)) errors.email = '대학 이메일(.ac.kr / .edu)만 가입할 수 있어'
  if (!isValidPassword(form.password)) errors.password = '영문+숫자 포함 8자 이상이어야 해'
  if (form.password !== form.passwordConfirm) errors.passwordConfirm = '비밀번호가 서로 달라'
  if (form.name.trim().length < 2) errors.name = '이름을 2자 이상 입력해줘'
  if (!form.school.trim()) errors.school = '학교를 입력해줘'
  if (!form.major.trim()) errors.major = '전공을 입력해줘'
  return errors
}

function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: undefined })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const next = validate(form)
    setErrors(next)
    if (Object.keys(next).length) return

    setServerError('')
    setLoading(true)
    try {
      await signup(form)
      setDone(true)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Layout>
        <div className={styles.done}>
          <div className={styles.check}>✓</div>
          <Heading sub="이제 로그인하고 성향 테스트를 시작해봐">가입 완료!</Heading>
          <Button onClick={() => navigate('/login', { replace: true })}>로그인하러 가기</Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout showBack>
      <Heading sub="대학 이메일로 학생 인증을 해요">처음 왔구나, 반가워</Heading>

      {serverError && <Notice tone="error">{serverError}</Notice>}

      <form onSubmit={onSubmit} noValidate>
        <Field label="대학 이메일" error={errors.email}>
          <Input name="email" type="email" placeholder="you@univ.ac.kr" value={form.email} onChange={onChange} invalid={!!errors.email} />
        </Field>
        <Field label="비밀번호" error={errors.password} hint="영문 + 숫자 포함 8자 이상">
          <Input name="password" type="password" value={form.password} onChange={onChange} invalid={!!errors.password} />
        </Field>
        <Field label="비밀번호 확인" error={errors.passwordConfirm}>
          <Input name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={onChange} invalid={!!errors.passwordConfirm} />
        </Field>
        <Field label="이름" error={errors.name}>
          <Input name="name" placeholder="홍길동" value={form.name} onChange={onChange} invalid={!!errors.name} />
        </Field>
        <div className={styles.row}>
          <Field label="학교" error={errors.school}>
            <Input name="school" placeholder="한양대" value={form.school} onChange={onChange} invalid={!!errors.school} />
          </Field>
          <Field label="전공" error={errors.major}>
            <Input name="major" placeholder="산업디자인" value={form.major} onChange={onChange} invalid={!!errors.major} />
          </Field>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? '가입 중…' : '가입하기'}
        </Button>
      </form>

      <p className={styles.footer}>
        이미 계정이 있어? <Link to="/login">로그인</Link>
      </p>
    </Layout>
  )
}

export default Signup
