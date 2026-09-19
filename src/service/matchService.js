import api, { USE_MOCK } from './api'
import { sleep, loadJson, saveJson } from '../utils'

// ---------- 테이블 방식 매칭 ----------
// 방장: 날짜·시간·인원을 정해 테이블을 연다 (POST /match/request/)
// 멤버: 열린 테이블 목록에서 골라 신청한다 (GET /match/open/ → POST /match/{id}/join/)
// 정원이 차면 status 가 done 이 되고 AI가 조합 이유·아이스브레이커를 만든다 (GET /match/{id}/)

const MOCK_AI = {
  reason:
    '넷 다 낯가림은 있지만 막상 얘기 시작하면 잘 안 멈추는 타입이라 골랐어요. "요즘 꽂힌 거" 이야기하면 분위기 제대로 탈 것 같아요.',
  icebreakers: [
    '최근에 "이거 왜 이제 알았지" 싶었던 거 하나씩 말해보기',
    '각자 전공 용어로 지금 기분 설명해보기',
    '지금 당장 어디든 갈 수 있다면, 어디로 갈지',
  ],
  scores: { similarity: 0.78, diversity: 0.86 },
}

// mock 참가자 풀 (내 테이블을 채우거나, 열린 테이블의 호스트/멤버로 쓰인다)
const MOCK_PEOPLE = [
  { id: 1, name: '서윤', major: '산업디자인', school: '한양대', interest: '요즘 필름카메라에 빠짐' },
  { id: 2, name: '민재', major: '컴퓨터공학', school: '순천향대', interest: '주말마다 클라이밍 다님' },
  { id: 3, name: '하은', major: '심리학', school: '이화여대', interest: '요즘 드로잉 다시 시작함' },
  { id: 4, name: '도현', major: '경영학', school: '건국대', interest: '새벽 러닝에 재미 붙임' },
  { id: 5, name: '지우', major: '건축학', school: '홍익대', interest: '동네 빵집 도장깨기 중' },
  { id: 6, name: '태윤', major: '기계공학', school: '서울시립대', interest: '보드게임 모임 운영' },
]

// ---------- 시간대 ----------
export const MEAL_SLOTS = [
  { value: 'lunch', label: '점심', time: '12:00' },
  { value: 'dinner', label: '저녁', time: '18:30' },
]
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
export const CAPACITY_OPTIONS = [3, 4, 5, 6] // 나 포함 정원

// 로컬 날짜 → 'YYYY-MM-DD' (슬롯 id · 달력 선택 키)
export function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function slotLabel(at, now = new Date()) {
  const diff = Math.round((startOfDay(at) - startOfDay(now)) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  return `${at.getMonth() + 1}/${at.getDate()}(${DAY_LABELS[at.getDay()]})`
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// 특정 날짜의 점심/저녁 슬롯. 이미 지난 시간대는 제외. id 형식 'YYYY-MM-DD-lunch' 는 API 의 slots 값
export function slotsForDate(date, now = new Date()) {
  return MEAL_SLOTS.flatMap((m) => {
    const [h, min] = m.time.split(':').map(Number)
    const at = new Date(date)
    at.setHours(h, min, 0, 0)
    if (at <= now) return []
    return [{ id: `${dateKey(at)}-${m.value}`, at: at.toISOString(), meal: m.value, label: `${slotLabel(at, now)} ${m.label}` }]
  })
}

// 오늘부터 7일간의 (날짜 × 점심/저녁) 후보
export function upcomingSlots(now = new Date()) {
  const slots = []
  for (let d = 0; d < 7; d += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + d)
    slots.push(...slotsForDate(day, now))
  }
  return slots
}

// 슬롯 id → 식사 시각 ISO (mock 에서 mealAt 계산용)
function slotToMealAt(slotId) {
  const [y, m, d, meal] = slotId.split('-')
  const { time } = MEAL_SLOTS.find((s) => s.value === meal) ?? MEAL_SLOTS[0]
  const [h, min] = time.split(':').map(Number)
  return new Date(Number(y), Number(m) - 1, Number(d), h, min).toISOString()
}

// 식사 시각 표시: '9/22(화) 점심 12:00'
export function formatMealAt(iso) {
  const d = new Date(iso)
  const meal = d.getHours() < 15 ? '점심' : '저녁'
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]}) ${meal} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---------- mock 저장소 ----------
const TABLES_KEY = 'mt_mock_tables'
const JOIN_INTERVAL = 2500 // mock: 이 간격으로 다른 멤버가 한 명씩 들어온다

function loadTables() {
  return loadJson(TABLES_KEY, {})
}
function saveTable(table) {
  saveJson(TABLES_KEY, { ...loadTables(), [table.id]: table })
}

// 시간이 지나면 다른 멤버가 채워진 것으로 계산해 현재 상태를 만든다
function mockTableState(table, me) {
  const joinedCount = Math.min(table.capacity, table.members.length + Math.floor((Date.now() - table.joinedAt) / JOIN_INTERVAL))
  const pool = MOCK_PEOPLE.filter((p) => !table.members.some((m) => m.id === p.id)).map((p) =>
    table.sameSchoolOnly ? { ...p, school: me.school } : p,
  )
  const members = [...table.members, ...pool.slice(0, joinedCount - table.members.length).map((p) => ({ ...p, isHost: false }))]
  const status = members.length >= table.capacity ? 'done' : 'open'
  return {
    status,
    result: {
      id: table.id,
      hostId: table.hostId,
      mealAt: table.mealAt,
      capacity: table.capacity,
      sameSchoolOnly: table.sameSchoolOnly,
      members,
      reason: status === 'done' ? MOCK_AI.reason : null,
      scores: status === 'done' ? MOCK_AI.scores : null,
      icebreakers: status === 'done' ? MOCK_AI.icebreakers : [],
    },
  }
}

function meAsMember(me, isHost) {
  return { id: me.id, name: me.name, major: me.major ?? '전공 미입력', school: me.school ?? '학교 미인증', interest: me.interest ?? '', isHost }
}

// mock 열린 테이블 목록 (남이 연 테이블). 매번 같은 목록이 보이도록 오늘 기준으로 생성
function mockOpenTables(me) {
  const slots = upcomingSlots()
  const pick = (i) => slots[Math.min(i, slots.length - 1)]?.at
  const base = [
    { id: 'open-1', mealAt: pick(1), capacity: 4, memberCount: 2, sameSchoolOnly: false, host: MOCK_PEOPLE[0] },
    { id: 'open-2', mealAt: pick(3), capacity: 3, memberCount: 1, sameSchoolOnly: false, host: MOCK_PEOPLE[1] },
    { id: 'open-3', mealAt: pick(4), capacity: 6, memberCount: 4, sameSchoolOnly: true, host: { ...MOCK_PEOPLE[2], school: me.school ?? '한양대' } },
    { id: 'open-4', mealAt: pick(6), capacity: 4, memberCount: 3, sameSchoolOnly: false, host: MOCK_PEOPLE[4] },
  ]
  const tables = loadTables()
  return base
    .filter((t) => t.mealAt)
    .filter((t) => !t.sameSchoolOnly || (me.schoolVerified && t.host.school === me.school)) // 같은 학교 전용은 같은 학교 인증 사용자에게만
    .map((t) => ({ ...t, host: { name: t.host.name, school: t.host.school, major: t.host.major }, joined: Boolean(tables[t.id]) }))
}

// ---------- ① 테이블 만들기 (방장) ----------
// slot: 'YYYY-MM-DD-lunch' 1개 · capacity: 나 포함 3~6 · sameSchoolOnly: 학교 인증 사용자만 true
export async function createTable(me, slot, { capacity = 4, sameSchoolOnly = false } = {}) {
  if (USE_MOCK) {
    await sleep(400)
    const table = {
      id: `match-${Date.now()}`,
      hostId: me.id,
      mealAt: slotToMealAt(slot),
      capacity,
      sameSchoolOnly,
      members: [meAsMember(me, true)],
      joinedAt: Date.now(),
    }
    saveTable(table)
    return { matchId: table.id, status: 'open' }
  }
  const { data } = await api.post('/match/request/', { userId: me.id, slots: [slot], sameSchoolOnly, capacity })
  return data
}

// ---------- ② 열린 테이블 목록 (멤버) ----------
export async function getOpenTables(me) {
  if (USE_MOCK) {
    await sleep(500)
    return mockOpenTables(me)
  }
  const { data } = await api.get('/match/open/')
  return data
}

// AI 추천 테이블: 열린 테이블 항목 + fit(0~1) · fitReason · sharedInterests. 프로필 없으면 400
export async function getRecommendedTables(me) {
  if (USE_MOCK) {
    await sleep(700)
    const extras = {
      'open-1': { fit: 0.91, fitReason: '사진·전시 얘기가 잘 통할 조합이에요', sharedInterests: ['사진', '전시'] },
      'open-2': { fit: 0.74, fitReason: '운동 좋아하는 멤버가 많아요', sharedInterests: ['운동'] },
      'open-3': { fit: 0.66, fitReason: '같은 학교라 편하게 시작할 수 있어요', sharedInterests: [] },
      'open-4': { fit: 0.58, fitReason: '먹는 얘기로 금방 친해질 거예요', sharedInterests: ['맛집'] },
    }
    return mockOpenTables(me)
      .map((t) => ({ ...t, ...extras[t.id] }))
      .sort((a, b) => b.fit - a.fit)
  }
  const { data } = await api.get(`/match/${me.id}/recommend/`)
  return data
}

// ---------- ③ 테이블 신청 (멤버) ----------
// 400: 이미 신청 / 정원 마감 / 시간 겹침 · 403: 같은 학교 전용
export async function joinTable(me, table) {
  if (USE_MOCK) {
    await sleep(400)
    if (loadTables()[table.id]) throw new Error('이미 신청한 테이블이에요')
    const host = MOCK_PEOPLE.find((p) => p.name === table.host.name) ?? MOCK_PEOPLE[0]
    const others = MOCK_PEOPLE.filter((p) => p.id !== host.id).slice(0, table.memberCount - 1)
    const members = [{ ...host, isHost: true }, ...others.map((p) => ({ ...p, isHost: false })), meAsMember(me, false)].map((m) =>
      table.sameSchoolOnly ? { ...m, school: me.school } : m,
    )
    const saved = { id: table.id, hostId: host.id, mealAt: table.mealAt, capacity: table.capacity, sameSchoolOnly: table.sameSchoolOnly, members, joinedAt: Date.now() }
    saveTable(saved)
    const { status, result } = mockTableState(saved, me)
    return { status, memberCount: result.members.length, capacity: table.capacity }
  }
  const { data } = await api.post(`/match/${table.id}/join/`, {})
  return data
}

// ---------- ④ 테이블 상세/상태 ----------
// open 동안 reason/scores 는 null, icebreakers 는 [] · done 이면 AI 결과 포함
export async function getMatchResult(matchId, me) {
  if (USE_MOCK) {
    await sleep(300)
    const table = loadTables()[matchId]
    if (!table) throw new Error('테이블을 찾을 수 없어요')
    return mockTableState(table, me)
  }
  const { data } = await api.get(`/match/${matchId}/`)
  return data
}

// 마이페이지용 매칭 기록
export async function getMatchHistory(userId) {
  if (USE_MOCK) {
    await sleep(300)
    return [
      { id: 'h1', date: '2026-09-12', groupSize: 4, restaurant: '온기설렁탕', status: 'done' },
      { id: 'h2', date: '2026-08-28', groupSize: 3, restaurant: '나폴리 화덕피자', status: 'done' },
    ]
  }
  const { data } = await api.get(`/users/${userId}/matches/`)
  return data
}
