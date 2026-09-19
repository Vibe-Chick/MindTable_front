import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Heading, Notice } from '../../components/ui/ui'
import {
  CAPACITY_OPTIONS,
  createTable,
  dateKey,
  formatMealAt,
  getMatchResult,
  getOpenTables,
  getRecommendedTables,
  joinTable,
  slotsForDate,
  upcomingSlots,
} from '../../service/matchService'
import SlotCalendar from './SlotCalendar'
import { notifyLocal } from '../../service/pushService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import { loadJson, saveJson } from '../../utils'
import styles from './Matching.module.css'

// 정원이 찼을 때 AI 파이프라인 단계 (백엔드 플로우를 보여주는 로딩)
const STEPS = ['성격(Big Five) 유사도 계산 중…', '전공 · 학교 다양성 점수 계산 중…', '매칭 이유 · 아이스브레이커 생성 중…']

// 내가 열었거나 신청해서 아직 안 찬 테이블 id — 앱을 다시 열어도 대기 화면으로 돌아오게
const PENDING_KEY = 'mt_pending_match'

// 매칭: 방장(테이블 만들기: 날짜·시간·인원) 또는 멤버(열린 테이블에 신청) → 정원이 차면 AI 결과 → 식당 추천
function Matching() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setMatch } = useMatch()
  const [mode, setMode] = useState('create') // create(방장) | join(멤버)
  const [pendingId, setPendingId] = useState(() => loadJson(PENDING_KEY))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ---- 방장: 날짜·시간 (목록 클릭 / 달력 중 하나) ----
  const [dateMode, setDateMode] = useState('chips') // chips | calendar
  const [slots] = useState(() => upcomingSlots())
  const [slot, setSlot] = useState(null) // 'YYYY-MM-DD-lunch' 1개
  const [calDate, setCalDate] = useState(null)
  const [capacity, setCapacity] = useState(4)
  const [sameSchoolOnly, setSameSchoolOnly] = useState(false)

  // ---- 멤버: 열린 테이블 목록 ----
  const [listMode, setListMode] = useState('all') // all | ai
  const [tables, setTables] = useState(null)

  // ---- 대기/완료 ----
  const [table, setTable] = useState(null) // GET /match/{id}/ 의 result
  const [doneSteps, setDoneSteps] = useState(0)
  const [ready, setReady] = useState(false)

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

  const startWaiting = (matchId) => {
    saveJson(PENDING_KEY, matchId)
    setPendingId(matchId)
  }

  // 방장: 테이블 열기
  const create = () =>
    run(async () => {
      if (!slot) throw new Error('날짜와 시간을 골라줘')
      const { matchId } = await createTable(user, slot, { capacity, sameSchoolOnly })
      startWaiting(matchId)
    })

  // 멤버: 테이블 신청
  const join = (t) =>
    run(async () => {
      await joinTable(user, t)
      startWaiting(t.id)
    })

  // 멤버: 목록 불러오기 (전체 / AI 추천순)
  useEffect(() => {
    if (mode !== 'join' || pendingId) return undefined
    let cancelled = false
    const load = listMode === 'ai' ? getRecommendedTables : getOpenTables
    load(user)
      .then((list) => !cancelled && setTables(list))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [mode, listMode, pendingId, user])

  // 대기: 2초마다 테이블 상태 확인 → done 이면 AI 단계 연출 후 결과로
  useEffect(() => {
    if (!pendingId) return undefined
    let cancelled = false
    let timer = null
    const stepTimers = []
    const check = async () => {
      try {
        const { status, result } = await getMatchResult(pendingId, user)
        if (cancelled) return
        setTable(result)
        if (status === 'cancelled') {
          localStorage.removeItem(PENDING_KEY)
          setPendingId(null)
          setError('테이블이 취소됐어요')
          return
        }
        if (status !== 'done') return
        cancelled = true
        clearInterval(timer)
        localStorage.removeItem(PENDING_KEY)
        setMatch(result)
        STEPS.forEach((_, i) => stepTimers.push(setTimeout(() => setDoneSteps(i + 1), 600 * (i + 1))))
        stepTimers.push(
          setTimeout(() => {
            setReady(true)
            notifyLocal({
              type: 'match_done',
              title: '✨ 테이블이 다 찼어요',
              body: `${result.members.map((m) => m.name).join(' · ')} — ${formatMealAt(result.mealAt)}`,
              url: '/matching/result',
            })
          }, 600 * (STEPS.length + 1)),
        )
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    check()
    timer = setInterval(check, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
      stepTimers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId])

  // ---------- 대기 / 완료 ----------
  if (pendingId) {
    const filled = table?.members.length ?? 0
    const isDone = table && filled >= table.capacity
    return (
      <Layout title={isDone ? '매칭 완료' : '테이블 대기 중'}>
        <div className={styles.center}>
          {!ready && !error && <div className={styles.spinner} />}
          {ready && <div className={styles.check}>✓</div>}
          <Heading sub={table ? `🍽️ ${formatMealAt(table.mealAt)} · ${table.capacity}명 테이블` : ''}>
            {ready ? '테이블이 다 찼어요!' : isDone ? 'AI가 이 조합을\n분석하고 있어요' : `${filled}/${table?.capacity ?? '-'}명 모였어요`}
          </Heading>
          {error && <Notice tone="error">{error}</Notice>}

          {table && (
            <div className={styles.seats}>
              {Array.from({ length: table.capacity }).map((_, i) => {
                const m = table.members[i]
                return (
                  <div key={m?.id ?? `empty-${i}`} className={m ? styles.seatOn : styles.seat}>
                    <span className={styles.seatInitial}>{m ? m.name[0] : '?'}</span>
                    <span className={styles.seatName}>{m ? `${m.name}${m.isHost ? ' · 방장' : ''}` : '대기 중'}</span>
                  </div>
                )
              })}
            </div>
          )}

          {isDone && (
            <ul className={styles.steps}>
              {STEPS.map((label, i) => (
                <li key={label} className={i < doneSteps ? styles.stepDone : styles.step}>
                  <span className={styles.stepIcon}>{i < doneSteps ? '✓' : '·'}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
          {!isDone && <p className={styles.slotHint}>정원이 차면 알려줄게요. 앱을 닫아도 돼요</p>}
        </div>

        {ready ? (
          <Button onClick={() => navigate('/matching/result', { replace: true })}>매칭 결과 보러가기</Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/home')}>
            홈으로
          </Button>
        )}
      </Layout>
    )
  }

  const calSlots = calDate ? slotsForDate(calDate) : []

  return (
    <Layout title="매칭" showBack>
      {/* 방장 / 멤버 선택 */}
      <div className={styles.modes} role="radiogroup" aria-label="참여 방식">
        <button type="button" role="radio" aria-checked={mode === 'create'} className={mode === 'create' ? styles.modeOn : styles.mode} onClick={() => setMode('create')}>
          <strong>테이블 만들기</strong>
          <small>날짜 · 시간 · 인원을 내가 정해요</small>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'join'} className={mode === 'join' ? styles.modeOn : styles.mode} onClick={() => {
            setMode('join')
            setTables(null)
          }}>
          <strong>테이블 참가하기</strong>
          <small>이미 열린 테이블에 들어가요</small>
        </button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      {/* ---------- 방장: 테이블 만들기 ---------- */}
      {mode === 'create' && (
        <>
          <Heading sub="정원이 차면 AI가 조합을 분석하고 식당까지 골라줘요">{'언제, 몇 명이서\n먹을까?'}</Heading>

          <div className={styles.label}>날짜 · 시간</div>
          <div className={styles.radios} role="radiogroup" aria-label="날짜 고르는 방식">
            <label className={styles.radio}>
              <input type="radio" name="dateMode" checked={dateMode === 'chips'} onChange={() => setDateMode('chips')} />
              이번 주 목록에서
            </label>
            <label className={styles.radio}>
              <input type="radio" name="dateMode" checked={dateMode === 'calendar'} onChange={() => setDateMode('calendar')} />
              달력에서 (28일)
            </label>
          </div>

          {dateMode === 'chips' && (
            <div className={styles.slots}>
              {slots.map((s) => (
                <button key={s.id} type="button" className={slot === s.id ? styles.slotOn : styles.slot} onClick={() => setSlot(s.id)}>
                  {s.meal === 'lunch' ? '🌤' : '🌙'} {s.label}
                </button>
              ))}
            </div>
          )}
          {dateMode === 'calendar' && (
            <>
              <SlotCalendar
                pickedDates={calDate ? [dateKey(calDate)] : []}
                onPick={(d) => {
                  setCalDate(d)
                  setSlot(null)
                }}
              />
              {calDate && (
                <div className={styles.slots}>
                  {calSlots.length === 0 && <p className={styles.slotHint}>이 날은 남은 시간대가 없어요</p>}
                  {calSlots.map((s) => (
                    <button key={s.id} type="button" className={slot === s.id ? styles.slotOn : styles.slot} onClick={() => setSlot(s.id)}>
                      {s.meal === 'lunch' ? '🌤' : '🌙'} {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className={styles.label}>인원 (나 포함)</div>
          <div className={styles.caps}>
            {CAPACITY_OPTIONS.map((n) => (
              <button key={n} type="button" className={capacity === n ? styles.capOn : styles.cap} onClick={() => setCapacity(n)}>
                {n}명
              </button>
            ))}
          </div>

          {user.schoolVerified && (
            <label className={styles.option}>
              <span>
                🎓 같은 학교끼리만
                <small>{sameSchoolOnly ? `${user.school} 인증 학생만 신청할 수 있어요` : '끄면 다른 학교 학생도 신청할 수 있어요'}</small>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={sameSchoolOnly}
                aria-label="같은 학교끼리만"
                className={sameSchoolOnly ? styles.toggleOn : styles.toggle}
                onClick={() => setSameSchoolOnly((v) => !v)}
              />
            </label>
          )}

          <div className={styles.spacer} />
          <Button onClick={create} disabled={!slot || loading}>
            {loading ? '여는 중…' : `${capacity}명 테이블 열기`}
          </Button>
        </>
      )}

      {/* ---------- 멤버: 열린 테이블 참가 ---------- */}
      {mode === 'join' && (
        <>
          <Heading sub="날짜 · 인원이 정해진 테이블이에요. 골라서 신청하면 끝">{'어느 테이블에\n앉을까?'}</Heading>

          <div className={styles.tabs}>
            <button type="button" className={listMode === 'all' ? styles.tabOn : styles.tab} onClick={() => {
                setListMode('all')
                setTables(null)
              }}>
              전체
            </button>
            <button type="button" className={listMode === 'ai' ? styles.tabOn : styles.tab} onClick={() => {
                setListMode('ai')
                setTables(null)
              }}>
              ✨ AI 추천
            </button>
          </div>

          {tables === null && <p className={styles.slotHint}>테이블 불러오는 중…</p>}
          {tables?.length === 0 && <Notice>지금 열린 테이블이 없어요. 직접 만들어볼까요?</Notice>}
          <div className={styles.tables}>
            {tables?.map((t) => (
              <div key={t.id} className={styles.table}>
                <div className={styles.tableTop}>
                  <strong>🍽️ {formatMealAt(t.mealAt)}</strong>
                  <span className={styles.seatsLeft}>
                    {t.memberCount}/{t.capacity}명
                  </span>
                </div>
                <p className={styles.tableHost}>
                  {t.host.name} 방장 · {t.host.school} {t.host.major}
                  {t.sameSchoolOnly && <span className={styles.tag}>🎓 같은 학교만</span>}
                </p>
                {t.fit != null && (
                  <p className={styles.fit}>
                    ✨ 잘 맞을 확률 {Math.round(t.fit * 100)}% · {t.fitReason}
                  </p>
                )}
                <Button variant={t.joined ? 'secondary' : 'primary'} disabled={t.joined || loading} onClick={() => join(t)}>
                  {t.joined ? '신청 완료' : '이 테이블 신청'}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}

export default Matching
