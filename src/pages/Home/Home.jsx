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

      {/* 테스트 전: 코랄 히어로 카드로 테스트를 가장 앞에. 나머지 카드는 흐리게 */}
      {!user.hasProfile && (
        <div className={styles.hero}>
          <strong>{'먼저 성향 테스트부터!\n3개 질문, 2분이면 끝나요'}</strong>
          <p>AI가 성향을 읽고 딱 맞는 사람을 골라줘요</p>
          <button type="button" className={styles.heroBtn} onClick={() => navigate('/test')}>
            테스트 시작하기 →
          </button>
        </div>
      )}

      <Card className={[styles.matchCard, user.hasProfile ? '' : styles.dim].join(' ')}>
        <div className={styles.matchIcon}>🍽️</div>
        <strong>이번 달 무료 매칭 1회</strong>
        <p>
          {!user.hasProfile
            ? '테스트가 끝나면 열려요'
            : user.schoolVerified
              ? '다른 학교 대학생과, 원하면 같은 학교끼리만 AI가 이어줘요'
              : '다른 학교 · 다른 전공 3명과 AI가 이어줘요'}
        </p>
        <Button onClick={() => navigate('/matching')} disabled={!user.hasProfile}>
          매칭 신청하기
        </Button>
      </Card>

      {!user.schoolVerified && (
        <Card className={[styles.lockedCard, user.hasProfile ? '' : styles.dim].join(' ')}>
          <div className={styles.matchIcon}>🎓</div>
          <strong>학교 인증하면 같은 학교 친구도</strong>
          <p>인증 없이도 다른 학교 학생과 매칭돼요. 인증하면 '같은 학교끼리만' 매칭을 고를 수 있어요.</p>
          <Button variant="secondary" onClick={() => navigate('/verify-school')}>
            학교 인증하기
          </Button>
        </Card>
      )}

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
      <Link to="/subscription" className={styles.subBanner}>
        🔥 학기 구독 · 월 3,900원으로 무제한 매칭 →
      </Link>
    </Layout>
  )
}

function formatMeal(iso) {
  const d = new Date(iso)
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${day}) ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default Home
