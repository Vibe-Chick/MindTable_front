import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { login as loginApi, loginWithKakao } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { nextRouteFor } from '../../utils'
import styles from './Login.module.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('') // '' | 'email' | 'kakao'

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // 로그인 성공 후 학교 인증 → 성향 테스트 → 메인 순으로 분기
  const finish = (data) => {
    login(data)
    navigate(nextRouteFor(data.user), { replace: true })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading('email')
    try {
      finish(await loginApi(form))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading('')
    }
  }

  const onKakao = async () => {
    setError('')
    setLoading('kakao')
    try {
      finish(await loginWithKakao())
    } catch (err) {
      setError(err.message)
      setLoading('')
    }
  }

  return (
    <Layout showBack>
      <Heading sub="카카오 또는 이메일로 로그인해줘">다시 만나서 반가워요</Heading>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="button" className={styles.kakao} onClick={onKakao} disabled={!!loading}>
        <span className={styles.kakaoIcon}>💬</span>
        {loading === 'kakao' ? '카카오로 이동 중…' : '카카오로 시작하기'}
      </button>

      <div className={styles.divider}>
        <span>또는 이메일로</span>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="이메일">
          <Input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required />
        </Field>
        <Field label="비밀번호">
          <Input name="password" type="password" placeholder="비밀번호" value={form.password} onChange={onChange} required />
        </Field>
        <Button type="submit" disabled={!!loading}>
          {loading === 'email' ? '확인 중…' : '이메일로 로그인'}
        </Button>
      </form>

      <div className={styles.links}>
        <Link to="/find-password">비밀번호를 잊었어요</Link>
        <span>·</span>
        <Link to="/signup">이메일로 회원가입</Link>
      </div>
    </Layout>
  )
}

export default Login
