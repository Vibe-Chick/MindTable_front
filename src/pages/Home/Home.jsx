import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Card, Heading } from '../../components/ui/ui'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import styles from './Home.module.css'

// 메인 화면: 매칭 신청 진입점 + 최근 매칭 요약
function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { match } = useMatch()

  const mypageLink = (
    <Link to="/mypage" className={styles.avatar} aria-label="마이페이지">
      {user.name[0]}
    </Link>
  )

  return (
    <Layout title="MindTable" right={mypageLink}>
      <Heading sub={user.schoolVerified ? `🎓 ${user.school} · ${user.major}` : '학교 인증 전'}>{`${user.name}님,\n오늘 누구랑 밥 먹을까?`}</Heading>

      {!user.schoolVerified && (
        <Card className={styles.warn}>
          <strong>학교 인증이 필요해요</strong>
          <p>대학 이메일로 인증해야 매칭을 받을 수 있어.</p>
          <Button variant="secondary" onClick={() => navigate('/verify-school')}>
            학교 인증 하러 가기
          </Button>
        </Card>
      )}

      {user.schoolVerified && !user.hasProfile && (
        <Card className={styles.warn}>
          <strong>성향 테스트를 아직 안 했어요</strong>
          <p>매칭을 받으려면 4개 질문에 먼저 답해줘.</p>
          <Button variant="secondary" onClick={() => navigate('/test')}>
            테스트 하러 가기
          </Button>
        </Card>
      )}

      <Card className={styles.matchCard}>
        <div className={styles.matchIcon}>🍽️</div>
        <strong>이번 달 무료 매칭 1회</strong>
        <p>다른 학교 · 다른 전공 3명과 AI가 이어줘요</p>
        <Button onClick={() => navigate('/matching')} disabled={!user.schoolVerified || !user.hasProfile}>
          매칭 신청하기
        </Button>
      </Card>

      {match && (
        <Card>
          <div className={styles.recentHead}>
            <strong>최근 매칭 그룹</strong>
            <Link to="/matching/result" className={styles.link}>
              다시 보기
            </Link>
          </div>
          <div className={styles.members}>
            {match.members.map((m) => (
              <span key={m.id} className={styles.member}>
                {m.name} · {m.major}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className={styles.spacer} />
      <Link to="/subscription" className={styles.subBanner}>
        🔥 학기 구독 · 월 3,900원으로 무제한 매칭 →
      </Link>
    </Layout>
  )
}

export default Home
