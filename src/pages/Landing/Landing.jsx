import { Link, Navigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { useAuth } from '../../store/AuthContext'
import { nextRouteFor } from '../../utils'
import styles from './Landing.module.css'

const FEATURES = [
  { icon: 'cap', title: '학교 인증 매칭', desc: '학교를 인증하면 다른 대학 학생들과 매칭돼요' },
  { icon: 'heart', title: 'AI 프로필 분석', desc: 'AI가 성향을 분석하고 프로필을 만들어요' },
  { icon: 'sparkle', title: '딱 좋은 조합', desc: '비슷하지만 낯선, 딱 좋은 조합을 찾아요' },
  { icon: 'fork', title: '제휴 식당 추천', desc: '캠퍼스 근처 제휴 식당까지 추천해요' },
]

// 초기 화면: 로그인 여부로 분기 (로그인돼 있으면 바로 다음 화면으로)
function Landing() {
  const { user, isLoggedIn } = useAuth()
  if (isLoggedIn) return <Navigate to={nextRouteFor(user)} replace />

  return (
    <Layout>
      <div className={styles.hero}>
        <div className={styles.logo}>
          <span className={styles.logoRing} />
        </div>
        <h1 className={styles.brand}>MindTable</h1>
        <p className={styles.tagline}>
          다른 학교 · 다른 전공 대학생을
          <br />
          AI가 골라 밥 약속으로 이어주는 매칭 서비스
        </p>
      </div>

      <ul className={styles.features}>
        {FEATURES.map((f) => (
          <li key={f.title} className={styles.feature}>
            <span className={styles.featureIcon}>
              <Icon name={f.icon} />
            </span>
            <span>
              <strong className={styles.featureTitle}>{f.title}</strong>
              <span className={styles.featureDesc}>{f.desc}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link to="/login" className={styles.cta}>
        Google 계정으로 시작하기
      </Link>
    </Layout>
  )
}

function Icon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'cap':
      return (
        <svg {...common}>
          <path d="M2 10l10-5 10 5-10 5z" />
          <path d="M6 12.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
          <path d="M22 10v6" />
        </svg>
      )
    case 'heart':
      return (
        <svg {...common}>
          <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          <path d="M12 14s-3.2-2-3.2-4.1a1.7 1.7 0 0 1 3.2-.8 1.7 1.7 0 0 1 3.2.8C15.2 12 12 14 12 14z" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6z" />
          <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
        </svg>
      )
    case 'fork':
      return (
        <svg {...common}>
          <path d="M6 3v7a2 2 0 0 0 2 2v9" />
          <path d="M8 3v6M10 3v6" />
          <path d="M17 3c-2 1-3 4-3 8h3v10" />
          <path d="M4 20l16-16" />
        </svg>
      )
    default:
      return null
  }
}

export default Landing
