import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import {
  LOCATION_OPTIONS,
  PRICE_OPTIONS,
  castVote,
  getRecommendedRestaurants,
  getVotes,
  reserveRestaurant,
  submitPreferences,
} from '../../service/restaurantService'
import { notifyLocal } from '../../service/pushService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import styles from './Restaurants.module.css'

// 식당 추천: 그룹 조건 입력 → 공통 조건 계산 → 제휴 식당 / 지도 fallback → 투표로 장소 확정 → 확정 알림
function Restaurants() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { match, restaurant, setRestaurant } = useMatch()
  const [step, setStep] = useState(restaurant ? 'confirmed' : 'prefs') // prefs | matching | list | confirmed
  const [prefs, setPrefs] = useState({ location: 'my-school', customLocation: '', price: 'mid', avoid: '' })
  const [common, setCommon] = useState(null)
  const [result, setResult] = useState(null) // { source, restaurants }
  const [tab, setTab] = useState('list') // list | map
  const [selected, setSelected] = useState(null)
  const [voteState, setVoteState] = useState({ votes: {}, confirmed: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 목록 단계에서 투표 현황을 2초마다 확인 → 과반 확정되면 예약하고 확정 화면으로
  useEffect(() => {
    if (!match || step !== 'list') return undefined
    let cancelled = false
    const check = async () => {
      const state = await getVotes(match.id)
      if (cancelled) return
      setVoteState(state)
      if (state.confirmed && result) {
        cancelled = true
        await reserveRestaurant(match.id, state.confirmed)
        const picked = result.restaurants.find((r) => r.id === state.confirmed)
        setRestaurant(picked)
        setStep('confirmed')
        notifyLocal({ type: 'place_confirmed', title: '📍 식사 장소가 확정됐어요', body: `${picked.name} · 도보 ${picked.walk} — 투표로 확정됐어요`, url: '/restaurants' })
        // 실서버: 식사 종료 2시간 후 백엔드가 발송. mock은 바로 띄워서 흐름 확인
        notifyLocal({ type: 'review_request', title: '📝 오늘의 테이블, 어땠어요?', body: '24시간 안에 테이블 리뷰를 남기면 프로필에 반영돼요', url: `/review/${match.id}` })
      }
    }
    check()
    const timer = setInterval(check, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, step, result])

  if (!match) return <Navigate to="/home" replace />

  const run = async (fn) => {
    setError('')
    setLoading(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ① 조건 제출 → 공통 조건 → 추천 조회
  const submitPrefs = () =>
    run(async () => {
      if (prefs.location === 'custom' && !prefs.customLocation.trim()) throw new Error('만날 장소를 입력해줘')
      setStep('matching')
      const c = await submitPreferences(match.id, prefs)
      setCommon(c.common)
      const r = await getRecommendedRestaurants(match.id, prefs)
      setResult(r)
      setSelected(r.restaurants[0]?.id ?? null)
      setStep('list')
    })

  // ③ 투표 → 과반이면 확정
  const vote = () =>
    run(async () => {
      const state = await castVote(match.id, selected, {
        userId: user.id,
        members: match.members,
        candidates: result.restaurants.map((r) => r.id),
      })
      setVoteState(state)
      // 과반 확정 여부는 위 폴링(useEffect)이 처리
    })

  // ---------- ① 그룹 조건 입력 ----------
  if (step === 'prefs') {
    return (
      <Layout title="식당 추천" showBack step={1} totalSteps={3}>
        <Heading sub="멤버들 조건을 모아서 중간 지점 · 공통 예산으로 골라줄게">{'어디서, 얼마쯤\n먹고 싶어?'}</Heading>
        {error && <Notice tone="error">{error}</Notice>}

        <div className={styles.label}>위치</div>
        <div className={styles.chips}>
          {LOCATION_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={prefs.location === o.value ? styles.chipOn : styles.chip}
              onClick={() => setPrefs({ ...prefs, location: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
        {prefs.location === 'custom' && (
          <Field>
            <Input placeholder="예: 왕십리역, 건대입구" value={prefs.customLocation} onChange={(e) => setPrefs({ ...prefs, customLocation: e.target.value })} />
          </Field>
        )}

        <div className={styles.label}>1인 예산</div>
        <div className={styles.chips}>
          {PRICE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={prefs.price === o.value ? styles.chipOn : styles.chip}
              onClick={() => setPrefs({ ...prefs, price: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Field label="못 먹는 음식 (선택)">
          <Input placeholder="예: 매운 것, 해산물" value={prefs.avoid} onChange={(e) => setPrefs({ ...prefs, avoid: e.target.value })} />
        </Field>

        <div className={styles.spacer} />
        <Button onClick={submitPrefs} disabled={loading}>
          조건 보내고 식당 찾기
        </Button>
      </Layout>
    )
  }

  // 공통 조건 계산 중
  if (step === 'matching') {
    return (
      <Layout>
        <div className={styles.center}>
          <div className={styles.spinner} />
          <Heading sub="멤버 조건을 모아 중간 지점과 예산 교집합을 계산하고 있어요">{'그룹 조건을\n맞춰보는 중'}</Heading>
        </div>
      </Layout>
    )
  }

  // ---------- ④ 확정 ----------
  if (step === 'confirmed' && restaurant) {
    return (
      <Layout title="장소 확정">
        <div className={styles.center}>
          <div className={styles.check}>✓</div>
          <Heading sub={`${restaurant.cuisine} · 도보 ${restaurant.walk}${restaurant.discount ? ` · ${restaurant.discount}` : ''}`}>
            {restaurant.name}
          </Heading>
          <Notice tone="success">투표로 확정됐어요. 그룹 멤버들에게 장소를 알렸어요</Notice>
          <div className={styles.members}>
            {match.members.map((m) => (
              <span key={m.id} className={styles.memberChip}>
                {m.name}
              </span>
            ))}
          </div>
          <div className={styles.spacer} />
          <Button onClick={() => navigate('/subscription')}>확인</Button>
        </div>
      </Layout>
    )
  }

  // ---------- ② 목록 / 지도 + ③ 투표 ----------
  const restaurants = result?.restaurants ?? []
  const tally = Object.values(voteState.votes).reduce((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {})
  const myVote = voteState.votes[user.id]
  const totalVotes = Object.keys(voteState.votes).length

  return (
    <Layout title="식당 추천" showBack step={2} totalSteps={3}>
      <Heading sub={common ? `📍 ${common.location} · ${PRICE_OPTIONS.find((p) => p.value === common.price)?.label}` : ''}>
        {result?.source === 'map' ? '제휴 식당이 없어서\n근처 식당을 찾았어요' : '캠퍼스 근처,\n이 팀에게 딱인 식당'}
      </Heading>

      {error && <Notice tone="error">{error}</Notice>}
      {result?.source === 'map' && <Notice>조건에 맞는 제휴 식당이 없어 지도에서 찾은 식당이에요. 할인은 적용되지 않아요</Notice>}

      <div className={styles.tabs}>
        <button type="button" className={tab === 'list' ? styles.tabOn : styles.tab} onClick={() => setTab('list')}>
          리스트
        </button>
        <button type="button" className={tab === 'map' ? styles.tabOn : styles.tab} onClick={() => setTab('map')}>
          지도
        </button>
      </div>

      {tab === 'map' && <MapView restaurants={restaurants} selected={selected} onSelect={setSelected} />}

      <div className={styles.list}>
        {restaurants.map((r) => (
          <button
            key={r.id}
            type="button"
            className={selected === r.id ? styles.itemOn : styles.item}
            onClick={() => !myVote && setSelected(r.id)}
            disabled={Boolean(myVote)}
          >
            <div className={styles.thumb} style={{ background: `linear-gradient(135deg, ${r.hue[0]}, ${r.hue[1]})` }} />
            <div className={styles.info}>
              <div className={styles.name}>{r.name}</div>
              <div className={styles.meta}>
                {r.cuisine} · 도보 {r.walk}
              </div>
              {r.discount ? <span className={styles.discount}>{r.discount}</span> : <span className={styles.noDiscount}>제휴 아님</span>}
            </div>
            {tally[r.id] > 0 && (
              <span className={styles.voteCount}>
                {tally[r.id]}표{myVote === r.id ? ' · 내 표' : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {totalVotes > 0 && (
        <p className={styles.voteStatus}>
          {totalVotes}/{match.members.length}명 투표 · 과반({Math.floor(match.members.length / 2) + 1}표)이면 확정돼요
        </p>
      )}

      <div className={styles.spacer} />
      {myVote ? (
        <Button variant="secondary" disabled>
          투표 완료 · 다른 멤버 기다리는 중
        </Button>
      ) : (
        <Button onClick={vote} disabled={!selected || loading}>
          {loading ? '투표 중…' : '이 식당에 투표하기'}
        </Button>
      )}
    </Layout>
  )
}

// 지도 탭: 지도 API 키가 붙기 전까지는 좌표 기반 간이 지도 (상대 위치만 표시)
function MapView({ restaurants, selected, onSelect }) {
  if (restaurants.length === 0) return null
  const lats = restaurants.map((r) => r.lat)
  const lngs = restaurants.map((r) => r.lng)
  const pad = 0.0015
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad
  const x = (lng) => ((lng - minLng) / (maxLng - minLng)) * 100
  const y = (lat) => (1 - (lat - minLat) / (maxLat - minLat)) * 100

  return (
    <div className={styles.map}>
      <div className={styles.mapGrid} />
      <span className={styles.mapMe} style={{ left: '50%', top: '50%' }} title="우리 위치" />
      {restaurants.map((r) => (
        <button
          key={r.id}
          type="button"
          className={selected === r.id ? styles.pinOn : styles.pin}
          style={{ left: `${x(r.lng)}%`, top: `${y(r.lat)}%` }}
          onClick={() => onSelect(r.id)}
        >
          <span className={styles.pinLabel}>{r.name}</span>
        </button>
      ))}
      <span className={styles.mapNote}>지도 API 연동 전 · 상대 위치만 표시</span>
    </div>
  )
}

export default Restaurants
