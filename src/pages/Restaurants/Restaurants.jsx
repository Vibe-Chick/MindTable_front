import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { LOCATION_OPTIONS, PRICE_OPTIONS, getRecommendedRestaurant, reserveRestaurant, submitPreferences } from '../../service/restaurantService'
import { notifyLocal } from '../../service/pushService'
import { useMatch } from '../../store/MatchContext'
import styles from './Restaurants.module.css'

// 식당 추천: 그룹 조건 입력 → 멤버 전원 제출 대기 → AI가 식당 한 곳 추천 (제휴 식당 / 지도 fallback) → 예약 → 확정 알림
function Restaurants() {
  const navigate = useNavigate()
  const { match, restaurant, setRestaurant } = useMatch()
  const [step, setStep] = useState(restaurant ? 'confirmed' : 'checking') // checking | prefs | waiting | confirmed
  const [prefs, setPrefs] = useState({ location: 'my-school', customLocation: '', price: 'mid', avoid: '' })
  const [progress, setProgress] = useState({ submitted: 0, total: 0 })
  const [result, setResult] = useState(null) // { common, source, restaurant, reason }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 추천 결과 확인: 들어올 때 한 번(다른 멤버가 이미 끝냈으면 바로 확정 화면) + 대기 단계에서 2초마다 폴링
  useEffect(() => {
    if (!match || step === 'prefs' || step === 'confirmed') return undefined
    let cancelled = false
    const check = async () => {
      try {
        const r = await getRecommendedRestaurant(match.id)
        if (cancelled) return
        setProgress({ submitted: r.submitted, total: r.total })
        if (r.status !== 'done' || !r.restaurant) {
          if (step === 'checking') setStep('prefs')
          return
        }
        cancelled = true
        await reserveRestaurant(match.id, r.restaurant.id)
        setResult(r)
        setRestaurant(r.restaurant)
        setStep('confirmed')
        if (step !== 'waiting') return
        notifyLocal({ type: 'place_confirmed', title: '📍 식사 장소가 정해졌어요', body: `${r.restaurant.name} · 도보 ${r.restaurant.walk} — AI가 골랐어요`, url: '/restaurants' })
        // 실서버: 식사 종료 2시간 후 백엔드가 발송. mock은 바로 띄워서 흐름 확인
        notifyLocal({ type: 'review_request', title: '📝 오늘의 테이블, 어땠어요?', body: '24시간 안에 테이블 리뷰를 남기면 프로필에 반영돼요', url: `/review/${match.id}` })
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        if (step === 'checking') setStep('prefs')
      }
    }
    check()
    if (step !== 'waiting') return undefined
    const timer = setInterval(check, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, step])

  if (!match) return <Navigate to="/home" replace />

  // ① 조건 제출 → 대기 (폴링은 위 useEffect)
  const submitPrefs = async () => {
    setError('')
    setLoading(true)
    try {
      if (prefs.location === 'custom' && !prefs.customLocation.trim()) throw new Error('만날 장소를 입력해줘')
      const c = await submitPreferences(match.id, prefs, { total: match.members.length })
      setProgress({ submitted: c.submitted, total: c.total })
      setStep('waiting')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'checking') {
    return (
      <Layout title="식당 추천">
        <div className={styles.center}>
          <div className={styles.spinner} />
        </div>
      </Layout>
    )
  }

  // ---------- ① 그룹 조건 입력 ----------
  if (step === 'prefs') {
    return (
      <Layout title="식당 추천" showBack step={1} totalSteps={2}>
        <Heading sub="멤버들 조건을 모아서 AI가 중간 지점 · 공통 예산에 맞는 식당을 한 곳 골라줄게">{'어디서, 얼마쯤\n먹고 싶어?'}</Heading>
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
          {loading ? '보내는 중…' : '조건 보내고 식당 찾기'}
        </Button>
      </Layout>
    )
  }

  // ---------- ② 멤버 전원 제출 대기 + AI 추천 중 ----------
  if (step === 'waiting') {
    return (
      <Layout title="식당 추천" step={2} totalSteps={2}>
        <div className={styles.center}>
          <div className={styles.spinner} />
          <Heading sub="모두 제출하면 AI가 조건을 맞춰 식당 한 곳을 골라요">{'멤버들 조건을\n기다리는 중'}</Heading>
          {error && <Notice tone="error">{error}</Notice>}
          <p className={styles.progress}>
            {progress.submitted}/{progress.total}명 조건 제출
          </p>
        </div>
      </Layout>
    )
  }

  // ---------- ③ 확정 ----------
  const common = result?.common
  return (
    <Layout title="장소 확정">
      <div className={styles.center}>
        <div className={styles.check}>✓</div>
        <Heading sub={`${restaurant.cuisine} · 도보 ${restaurant.walk}${restaurant.discount ? ` · ${restaurant.discount}` : ''}`}>{restaurant.name}</Heading>
        {common && (
          <p className={styles.common}>
            📍 {common.location} · {PRICE_OPTIONS.find((p) => p.value === common.price)?.label}
          </p>
        )}
        {result?.reason && <Notice tone="success">{result.reason}</Notice>}
        {result?.source === 'map' && <Notice>조건에 맞는 제휴 식당이 없어 지도에서 찾은 식당이에요. 할인은 적용되지 않아요</Notice>}
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

export default Restaurants
