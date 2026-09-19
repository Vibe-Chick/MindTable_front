import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice } from '../../components/ui/ui'
import { getRecommendedRestaurants, reserveRestaurant } from '../../service/restaurantService'
import { useMatch } from '../../store/MatchContext'
import styles from './Restaurants.module.css'

// 매칭 그룹 기반 제휴 식당 추천 → 예약
function Restaurants() {
  const navigate = useNavigate()
  const { match, restaurant, setRestaurant } = useMatch()
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(restaurant?.id ?? null)
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!match) return
    getRecommendedRestaurants(match.id)
      .then((data) => {
        setList(data)
        if (!selected && data[0]) setSelected(data[0].id)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match])

  if (!match) return <Navigate to="/home" replace />

  const reserve = async () => {
    setReserving(true)
    try {
      await reserveRestaurant(match.id, selected)
      setRestaurant(list.find((r) => r.id === selected))
      setDone(true)
    } finally {
      setReserving(false)
    }
  }

  if (done) {
    const r = list.find((x) => x.id === selected)
    return (
      <Layout>
        <div className={styles.center}>
          <div className={styles.check}>✓</div>
          <Heading sub={`${r.name} · ${r.discount}`}>예약 완료!</Heading>
          <Notice tone="success">그룹 멤버들에게 식당 정보를 보냈어요</Notice>
          <Button onClick={() => navigate('/subscription')}>확인</Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="식당 추천" showBack>
      <Heading sub="매칭 그룹 성향과 위치를 고려해 골랐어요">{'캠퍼스 근처,\n이 팀에게 딱인 식당'}</Heading>

      {loading && <p className={styles.loading}>식당을 찾는 중…</p>}

      <div className={styles.list}>
        {list.map((r) => (
          <button
            key={r.id}
            type="button"
            className={selected === r.id ? styles.itemOn : styles.item}
            onClick={() => setSelected(r.id)}
          >
            <div className={styles.thumb} style={{ background: `linear-gradient(135deg, ${r.hue[0]}, ${r.hue[1]})` }} />
            <div className={styles.info}>
              <div className={styles.name}>{r.name}</div>
              <div className={styles.meta}>
                {r.cuisine} · 도보 {r.walk}
              </div>
              <span className={styles.discount}>{r.discount}</span>
            </div>
          </button>
        ))}
      </div>

      <div className={styles.spacer} />
      <Button onClick={reserve} disabled={!selected || reserving}>
        {reserving ? '예약 중…' : '이 식당으로 예약할게요'}
      </Button>
    </Layout>
  )
}

export default Restaurants
