import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice } from '../../components/ui/ui'
import { exchangeKakaoCode } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { nextRouteFor } from '../../utils'

// 카카오 로그인 리다이렉트 URI(/oauth/kakao): 인가 코드를 백엔드에 넘겨 토큰을 받는다
function KakaoCallback() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { login } = useAuth()
  const code = params.get('code')
  const [error, setError] = useState(() =>
    code ? '' : params.get('error_description') || '카카오 인증이 취소됐어요',
  )

  useEffect(() => {
    if (!code) return
    exchangeKakaoCode(code)
      .then((data) => {
        login(data)
        navigate(nextRouteFor(data.user), { replace: true })
      })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Layout>
      {error ? (
        <>
          <Notice tone="error">{error}</Notice>
          <Button onClick={() => navigate('/login', { replace: true })}>로그인으로 돌아가기</Button>
        </>
      ) : (
        <Heading sub="잠시만 기다려줘">카카오 계정 확인 중…</Heading>
      )}
    </Layout>
  )
}

export default KakaoCallback
