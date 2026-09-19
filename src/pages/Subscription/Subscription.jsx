import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading } from '../../components/ui/ui'
import styles from './Subscription.module.css'

// 무료 매칭 소진 후 저가 구독 유도 (Timeleft 벤치마킹, 대학생 가격대)
function Subscription() {
  const navigate = useNavigate()

  return (
    <Layout showBack>
      <Heading>{'오늘 매칭은\n여기까지예요'}</Heading>

      <div className={styles.status}>
        <div className={styles.check}>✓</div>
        <div>
          <div className={styles.statusTitle}>이번 달 무료 매칭 1회 사용 완료</div>
          <div className={styles.statusSub}>다음 무료 매칭은 다음 달 1일에 열려요</div>
        </div>
      </div>

      <div className={styles.banner}>
        <div className={styles.bannerTag}>🔥 학기 구독</div>
        <div className={styles.price}>
          월 3,900원 <span>· 학기 동안 무제한 매칭</span>
        </div>
        <p>한 달에 한 번 말고, 새로운 사람을 더 자주 만나고 싶다면</p>
        <ul className={styles.perks}>
          <li>✓ 이번 주 안에 매칭받기</li>
          <li>✓ 전공 · 학교 필터링</li>
          <li>✓ 매칭 재신청</li>
        </ul>
        <Button onClick={() => alert('결제 연동은 백엔드 준비 후 붙일 예정이에요')}>구독하고 계속 매칭받기</Button>
      </div>

      <div className={styles.spacer} />
      <Button variant="ghost" onClick={() => navigate('/home', { replace: true })}>
        다음에 할게요
      </Button>
    </Layout>
  )
}

export default Subscription
