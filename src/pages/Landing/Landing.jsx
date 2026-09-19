import { Link, Navigate } from 'react-router-dom'
import { nextRouteFor } from '../../utils'
import Layout from '../../components/Layout/Layout'
import { Button } from '../../components/ui/ui'
import { useAuth } from '../../store/AuthContext'
import styles from './Landing.module.css'

// 초기 화면: 계정이 있는가 → 로그인 / 회원가입 분기
function Landing() {
  const { user, isLoggedIn } = useAuth()
  if (isLoggedIn) return <Navigate to={nextRouteFor(user)} replace />

  return (
    <Layout>
      <div className={styles.hero}>
        <div className={styles.logo}>🍚</div>
        <h1 className={styles.brand}>MindTable</h1>
        <p className={styles.tagline}>
          다른 학교 · 다른 전공 대학생을
          <br />
          AI가 골라 밥 약속으로 이어주는 매칭 서비스
        </p>
      </div>

      <ul className={styles.points}>
        <li>🎓 학교 인증하면 다른 대학 학생들과 매칭돼요</li>
        <li>💬 AI가 성향을 분석하고 프로필을 만들어요</li>
        <li>🎓 비슷하지만 낯선, 딱 좋은 조합을 찾아요</li>
        <li>🍽️ 캠퍼스 근처 제휴 식당까지 추천해요</li>
      </ul>

      <div className={styles.actions}>
        <Link to="/login">
          <Button>Google 계정으로 시작하기</Button>
        </Link>
      </div>
    </Layout>
  )
}

export default Landing
