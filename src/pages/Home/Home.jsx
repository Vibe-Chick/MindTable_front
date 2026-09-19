import { Link, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Card, Heading } from '../../components/ui/ui'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import { reviewWindow } from '../../service/reviewService'
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
      <Heading sub={user.schoolVerified ? `🎓 ${user.school} · ${user.major}` : `${user.email} · 학교 인증 전`}>{`${user.name}님,\n오늘 누구랑 밥 먹을까?`}</Heading>

      {!user.hasProfile && (
        <Card className={styles.warn}>
          <strong>성향 테스트를 아직 안 했어요</strong>
          <p>매칭을 받으려면 4개 질문에 먼저 답해줘.</p>
          <Button variant="secondary" onClick={() => navigate('/test')}>
            테스트 하러 가기
          </Button>
        </Card>
      )}

      {user.schoolVerified ? (
        <Card className={styles.matchCard}>
          <div className={styles.matchIcon}>🍽️</div>
          <strong>이번 달 무료 매칭 1회</strong>
          <p>다른 학교 · 다른 전공 3명과 AI가 이어줘요</p>
          <Button onClick={() => navigate('/matching')} disabled={!user.hasProfile}>
            매칭 신청하기
          </Button>
        </Card>
      ) : (
        <Card className={styles.lockedCard}>
          <div className={styles.matchIcon}>🔒</div>
          <strong>식사 매칭은 학교 인증 후에</strong>
          <p>인증된 대학(원)생끼리만 매칭돼요. 대학 이메일만 있으면 1분이면 끝나요.</p>
          <Button onClick={() => navigate('/verify-school')}>학교 인증하고 매칭 받기</Button>
          <ul className={styles.lockedList}>
            <li>매칭 신청 · 결과</li>
            <li>제휴 식당 추천</li>
            <li>학기 구독</li>
          </ul>
        </Card>
      )}

      {user.schoolVerified && match && (
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
          {reviewWindow(match.mealAt).notYet ? (
            <p className={styles.nextMeal}>🍽️ 다음 식사 {formatMeal(match.mealAt)}</p>
          ) : (
            <Button variant="secondary" className={styles.reviewBtn} onClick={() => navigate(`/review/${match.id}`)}>
              🍽️ 테이블 리뷰 남기기
            </Button>
          )}
        </Card>
      )}

      <div className={styles.spacer} />
      {user.schoolVerified && (
        <Link to="/subscription" className={styles.subBanner}>
          🔥 학기 구독 · 월 3,900원으로 무제한 매칭 →
        </Link>
      )}
    </Layout>
  )
}

function formatMeal(iso) {
  const d = new Date(iso)
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${day}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default Home
