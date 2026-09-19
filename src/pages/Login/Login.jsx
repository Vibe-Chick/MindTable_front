import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Heading, Notice } from '../../components/ui/ui'
import { loginWithGoogle } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { FREE_FEATURES, VERIFIED_ONLY_FEATURES, nextRouteFor } from '../../utils'
import styles from './Login.module.css'

// 로그인 수단은 Google 계정 하나. 가입 절차 없이 첫 로그인 시 계정이 생성된다.
function Login() {
  const navigate = useNavigate()
  const { user, isLoggedIn, login } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isLoggedIn) return <Navigate to={nextRouteFor(user)} replace />

  const onGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await loginWithGoogle()
      login(data)
      navigate(nextRouteFor(data.user), { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Layout showBack>
      <Heading sub="별도 회원가입 없이 Google 계정으로 바로 시작해요">{'Google 계정으로\n시작하기'}</Heading>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="button" className={styles.google} onClick={onGoogle} disabled={loading}>
        <GoogleIcon />
        {loading ? 'Google 계정 확인 중…' : 'Google로 계속하기'}
      </button>

      <div className={styles.info}>
        <div className={styles.infoBlock}>
          <div className={styles.infoTitle}>로그인만 하면</div>
          <ul>
            {FREE_FEATURES.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </div>
        <div className={styles.infoBlock}>
          <div className={styles.infoTitle}>🎓 학교 인증까지 하면</div>
          <ul>
            {VERIFIED_ONLY_FEATURES.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <p className={styles.infoNote}>학교 인증은 로그인 후 언제든 할 수 있어요</p>
        </div>
      </div>
    </Layout>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export default Login
