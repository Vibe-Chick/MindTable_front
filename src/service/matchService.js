import api, { USE_MOCK } from './api'
import { sleep } from '../utils'

const MOCK_RESULT = {
  id: 'match-1',
  reason:
    '넷 다 낯가림은 있지만 막상 얘기 시작하면 잘 안 멈추는 타입이라 골랐어요. "요즘 꽂힌 거" 이야기하면 분위기 제대로 탈 것 같아요.',
  members: [
    { id: 1, name: '서윤', major: '산업디자인', school: '한양대', interest: '요즘 필름카메라에 빠짐' },
    { id: 2, name: '민재', major: '컴퓨터공학', school: '순천향대', interest: '주말마다 클라이밍 다님' },
    { id: 3, name: '하은', major: '심리학', school: '이화여대', interest: '요즘 드로잉 다시 시작함' },
    { id: 4, name: '도현', major: '경영학', school: '건국대', interest: '새벽 러닝에 재미 붙임' },
  ],
  icebreakers: [
    '최근에 "이거 왜 이제 알았지" 싶었던 거 하나씩 말해보기',
    '각자 전공 용어로 지금 기분 설명해보기',
    '지금 당장 어디든 갈 수 있다면, 어디로 갈지',
  ],
  scores: { similarity: 0.78, diversity: 0.86 },
}

// ---------- 희망 시간대 ----------
// "정해진 배치 시각" 트리거: 사용자는 이번 주 식사 가능한 시간대를 고르고,
// 백엔드는 같은 시간대의 대기자끼리 묶는다. 'now'는 즉시 매칭.
export const MEAL_SLOTS = [
  { value: 'lunch', label: '점심', time: '12:00' },
  { value: 'dinner', label: '저녁', time: '18:30' },
]
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 로컬 날짜 → 'YYYY-MM-DD' (달력 선택 키)
export function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 특정 날짜의 점심/저녁 슬롯 (달력에서 고른 날짜용). id 형식은 upcomingSlots 와 동일
export function slotsForDate(date, now = new Date()) {
  return MEAL_SLOTS.flatMap((m) => {
    const [h, min] = m.time.split(':').map(Number)
    const at = new Date(date)
    at.setHours(h, min, 0, 0)
    if (at <= now) return []
    return [{ id: `${at.toISOString().slice(0, 10)}-${m.value}`, at: at.toISOString(), meal: m.value, label: `${at.getMonth() + 1}/${at.getDate()}(${DAY_LABELS[at.getDay()]}) ${m.label}` }]
  })
}

// 오늘부터 7일간의 (날짜 × 점심/저녁) 후보. 이미 지난 시간대는 제외
export function upcomingSlots(now = new Date()) {
  const slots = []
  for (let d = 0; d < 7; d += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + d)
    MEAL_SLOTS.forEach((m) => {
      const [h, min] = m.time.split(':').map(Number)
      const at = new Date(day)
      at.setHours(h, min, 0, 0)
      if (at > now) slots.push({ id: `${at.toISOString().slice(0, 10)}-${m.value}`, at: at.toISOString(), meal: m.value, label: `${d === 0 ? '오늘' : d === 1 ? '내일' : `${at.getMonth() + 1}/${at.getDate()}(${DAY_LABELS[at.getDay()]})`} ${m.label}` })
    })
  }
  return slots
}

let mockRequestedSlots = null
let mockSameSchool = null // mock: 같은 학교끼리만 선택 시 결과 멤버의 학교를 내 학교로 맞춘다

// 매칭 신청 (대기자 풀에 등록)
// slots:          희망 시간대 id 배열 또는 ['now']
// sameSchoolOnly: 학교 인증한 사용자만 선택 가능. true 면 같은 학교 인증 사용자끼리만 묶는다 (백엔드가 토큰의 학교로 판단)
// school:         mock 표시용 (실서버엔 보내지 않음)
export async function requestMatch(userId, slots = ['now'], { sameSchoolOnly = false, school = null } = {}) {
  if (USE_MOCK) {
    await sleep(400)
    mockRequestedSlots = slots
    mockSameSchool = sameSchoolOnly ? school : null
    return { matchId: 'match-1', status: 'queued' }
  }
  const { data } = await api.post('/match/request', { userId, slots, sameSchoolOnly })
  return data
}

// 매칭 진행 상태/결과 조회
export async function getMatchResult(matchId) {
  if (USE_MOCK) {
    await sleep(2500)
    // mock: 고른 시간대 중 첫 번째를 식사 시각으로 확정 (즉시 매칭이면 2시간 뒤)
    const first = mockRequestedSlots?.find((s) => s !== 'now')
    const mealAt = first ? upcomingSlots().find((s) => s.id === first)?.at : null
    const members = mockSameSchool ? MOCK_RESULT.members.map((m) => ({ ...m, school: mockSameSchool })) : MOCK_RESULT.members
    return { status: 'done', result: { ...MOCK_RESULT, members, mealAt: mealAt ?? new Date(Date.now() + 2 * 3600 * 1000).toISOString() } }
  }
  const { data } = await api.get(`/match/${matchId}`)
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
  const { data } = await api.get(`/users/${userId}/matches`)
  return data
}
