import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { login as loginApi } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import styles from './Login.module.css'

function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginApi(form)
      login(data)
      // 첫 로그인(프로필 없음) → 심리테스트, 아니면 메인
      navigate(data.user.hasProfile ? '/home' : '/test', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout showBack>
      <Heading sub="가입한 대학 이메일로 로그인해줘">다시 만나서 반가워요</Heading>

      {error && <Notice tone="error">{error}</Notice>}

      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="이메일">
          <Input name="email" type="email" placeholder="you@univ.ac.kr" value={form.email} onChange={onChange} required />
        </Field>
        <Field label="비밀번호">
          <Input name="password" type="password" placeholder="비밀번호" value={form.password} onChange={onChange} required />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading ? '확인 중…' : '로그인'}
        </Button>
      </form>

      <div className={styles.links}>
        <Link to="/find-password">비밀번호를 잊었어요</Link>
        <span>·</span>
        <Link to="/signup">회원가입</Link>
      </div>
    </Layout>
  )
}

export default Login
