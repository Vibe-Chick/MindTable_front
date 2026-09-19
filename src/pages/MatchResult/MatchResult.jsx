import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Card, Heading } from '../../components/ui/ui'
import { useMatch } from '../../store/MatchContext'
import styles from './MatchResult.module.css'

// 매칭 결과(그룹 + AI 설명) → 아이스브레이커 → 식당 추천으로 연계
function MatchResult() {
  const navigate = useNavigate()
  const { match } = useMatch()
  const [tab, setTab] = useState('group') // group | icebreaker

  if (!match) return <Navigate to="/home" replace />

  return (
    <Layout title="매칭 결과" showBack>
      <div className={styles.badge}>✨ 매칭 완료</div>
      <Heading sub="🎓 다른 전공 · 다른 학교 조합">{'이런 사람들과\n밥 먹게 됐어요'}</Heading>

      <div className={styles.tabs}>
        <button type="button" className={tab === 'group' ? styles.tabOn : styles.tab} onClick={() => setTab('group')}>
          그룹
        </button>
        <button
          type="button"
          className={tab === 'icebreaker' ? styles.tabOn : styles.tab}
          onClick={() => setTab('icebreaker')}
        >
          아이스브레이커
        </button>
      </div>

      {tab === 'group' && (
        <>
          <Card className={styles.reason}>
            <span className={styles.reasonLabel}>AI가 이 조합을 고른 이유</span>
            <p>{match.reason}</p>
            <div className={styles.scores}>
              <span>유사도 {Math.round(match.scores.similarity * 100)}%</span>
              <span>다양성 {Math.round(match.scores.diversity * 100)}%</span>
            </div>
          </Card>

          <div className={styles.members}>
            {match.members.map((m) => (
              <div key={m.id} className={styles.member}>
                <div className={styles.initial}>{m.name[0]}</div>
                <div>
                  <div className={styles.name}>{m.name}</div>
                  <div className={styles.meta}>
                    {m.major} · {m.school}
                  </div>
                  <div className={styles.interest}>💬 {m.interest}</div>
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" onClick={() => setTab('icebreaker')}>
            아이스브레이커 보기
          </Button>
        </>
      )}

      {tab === 'icebreaker' && (
        <>
          <p className={styles.iceIntro}>
            이 그룹만을 위해 AI가 만든 질문이에요. 어색해지면 이 중에 하나 던져봐.
          </p>
          <div className={styles.topics}>
            {match.icebreakers.map((text, i) => (
              <div key={text} className={styles.topic}>
                <span className={styles.topicNum}>{i + 1}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={styles.spacer} />
      <Button onClick={() => navigate('/restaurants')}>근처 식당 보기</Button>
    </Layout>
  )
}

export default MatchResult
