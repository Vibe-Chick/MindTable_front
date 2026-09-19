import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Heading, Notice } from '../../components/ui/ui'
import { GOOGLE_LIVE, exchangeGoogleCredential, loginWithGoogle, renderGoogleButton, requestSchoolCode } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { isUniversityEmail, nextRouteFor } from '../../utils'
import styles from './Login.module.css'

// 로그인 수단은 Google 계정 하나. 가입 절차 없이 첫 로그인 시 계정이 생성된다.
// 실서버: Google 공식 버튼(팝업) → credential → 백엔드 /api/auth/google/
// mock:   우리 버튼 → 가짜 사용자
function Login() {
  const navigate = useNavigate()
  const { user, isLoggedIn, login } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleBtn = useRef(null)

  // 로그인 직후: Google 계정이 대학 메일이고 아직 미인증이면 그 주소로 인증 코드를 바로 보내고 코드 입력 화면으로
  const finish = async (data) => {
    login(data)
    const u = data.user
    if (!u.schoolVerified && isUniversityEmail(u.email)) {
      try {
        const { school } = await requestSchoolCode(u.id, u.email)
        navigate('/verify-school', { replace: true, state: { univEmail: u.email, school, sent: true } })
        return
      } catch {
        /* 발송 실패해도 로그인은 유지 — 학교 인증 화면에서 다시 시도 */
      }
    }
    navigate(nextRouteFor(u), { replace: true })
  }

  // 실서버 모드: Google 버튼 렌더링
  useEffect(() => {
    if (!GOOGLE_LIVE || isLoggedIn || !googleBtn.current) return
    renderGoogleButton(googleBtn.current, async (credential) => {
      setError('')
      setLoading(true)
      try {
        finish(await exchangeGoogleCredential(credential))
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }).catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  if (isLoggedIn) return <Navigate to={nextRouteFor(user)} replace />

  const onMockGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      finish(await loginWithGoogle())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <Layout showBack>
      <Heading sub="별도 회원가입 없이 Google 계정으로 바로 시작해요">{'Google 계정으로\n시작하기'}</Heading>

      {error && <Notice tone="error">{error}</Notice>}

      {GOOGLE_LIVE ? (
        <div className={styles.googleWrap}>
          <div ref={googleBtn} className={loading ? styles.googleBusy : ''} />
          {loading && <p className={styles.note}>Google 계정 확인 중…</p>}
        </div>
      ) : (
        <button type="button" className={styles.google} onClick={onMockGoogle} disabled={loading}>
          <GoogleIcon />
          {loading ? 'Google 계정 확인 중…' : 'Google로 계속하기'}
        </button>
      )}

      <p className={styles.note}>학교 인증은 로그인 후에 할 수 있어요</p>
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
