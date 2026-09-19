import api, { isLive } from './api'
import { sleep, loadJson, saveJson } from '../utils'

// 테이블 리뷰(플로우차트의 '보정'): 자유서술 3문항 + 강제선택 1문항
// 답변 → LLM이 Big Five 축별 델타(-1~+1) 추출 → 프로필 보정
export const REVIEW_QUESTIONS = [
  {
    id: 'r1',
    type: 'open',
    trait: 'extraversion',
    title: '오늘 대화에서 가장 재밌었던 순간은?\n그때 너는 어떤 편이었어?',
    hint: '말을 많이 했는지, 듣는 쪽이었는지도 같이',
  },
  {
    id: 'r2',
    type: 'open',
    trait: 'openness',
    title: '새로 알게 됐거나\n생각이 바뀐 게 있어?',
    hint: '전공 얘기든 취향이든, 작은 거라도',
  },
  {
    id: 'r3',
    type: 'open',
    trait: 'agreeableness',
    title: '의견이 갈리거나 어색했던 순간이 있었다면,\n어떻게 넘겼어?',
    hint: '없었다면 없었던 이유도 좋아',
  },
  {
    id: 'r4',
    type: 'choice',
    trait: 'diversity',
    title: '다음 매칭에서는\n어떤 사람들을 만나고 싶어?',
    hint: '다음 매칭에 반영돼요',
    options: [
      { value: 'similar', emoji: '🤝', label: '오늘처럼 잘 맞는 사람들' },
      { value: 'different', emoji: '🧭', label: '더 다른 배경의 사람들' },
    ],
  },
]

export const REVIEW_DEADLINE_HOURS = 24
export const REVIEW_REQUEST_AFTER_HOURS = 2 // 식사 종료 2시간 후 리뷰 요청

// 식사 시각 기준 리뷰 창(요청 시점 ~ 마감) 계산. mealAt 없으면 제한 없음
export function reviewWindow(mealAt, now = new Date()) {
  if (!mealAt) return { opensAt: null, closesAt: null, notYet: false, open: true, expired: false, hoursLeft: null }
  const meal = new Date(mealAt)
  const opensAt = new Date(meal.getTime() + REVIEW_REQUEST_AFTER_HOURS * 3600 * 1000)
  const closesAt = new Date(opensAt.getTime() + REVIEW_DEADLINE_HOURS * 3600 * 1000)
  const notYet = now < opensAt // 아직 식사 전(또는 식사 직후 2시간 내)
  const expired = now > closesAt
  return { opensAt, closesAt, notYet, open: !notYet && !expired, expired, hoursLeft: Math.max(0, Math.ceil((closesAt - now) / 3600000)) }
}

const REVIEWS_KEY = 'mt_mock_reviews'

function getMockReviews() {
  return loadJson(REVIEWS_KEY, {})
}

// 리뷰 제출 여부/마감 정보
export async function getReviewStatus(matchId) {
  if (!isLive('review/status')) {
    await sleep(200)
    const saved = getMockReviews()[matchId]
    return saved ? { submitted: true, result: saved } : { submitted: false }
  }
  const { data } = await api.get(`/match/${matchId}/review/`)
  return data
}

// 리뷰 제출 → 보정 결과(델타, 갱신된 프로필) 반환
export async function submitReview(matchId, answers, currentBigFive) {
  if (!isLive('review/submit')) {
    await sleep(2000)
    const text = [answers.r1, answers.r2, answers.r3].join(' ')
    // mock 델타: 답변 길이/선택으로 대충 흉내 (실제는 LLM 추출 후 ±0.5 클리핑)
    const deltas = {
      openness: clip(text.includes('새로') || text.includes('처음') ? 0.4 : 0.1),
      conscientiousness: 0,
      extraversion: clip(text.includes('많이') || text.includes('먼저') ? 0.3 : -0.2),
      agreeableness: clip(text.includes('맞춰') || text.includes('들어') ? 0.3 : 0.1),
      neuroticism: clip(text.includes('긴장') || text.includes('불편') ? 0.2 : -0.1),
    }
    const before = currentBigFive ?? { openness: 3, conscientiousness: 3, extraversion: 3, agreeableness: 3, neuroticism: 3 }
    const after = Object.fromEntries(
      Object.entries(before).map(([k, v]) => [k, Math.round(Math.min(5, Math.max(1, v + deltas[k])) * 10) / 10]),
    )
    const diversityPref = answers.r4 === 'different' ? 0.65 : 0.35
    const result = {
      deltas,
      before,
      after,
      diversityPref,
      summary:
        answers.r4 === 'different'
          ? '오늘 조합이 잘 맞았고, 다음엔 더 낯선 배경도 열려 있는 편이에요'
          : '오늘 같은 조합에서 편안함을 느꼈어요. 비슷한 결의 사람들과 더 잘 맞아요',
      driftAlert: Object.values(deltas).some((d) => Math.abs(d) >= 0.5),
      submittedAt: new Date().toISOString(),
    }
    saveJson(REVIEWS_KEY, { ...getMockReviews(), [matchId]: result })
    return result
  }
  const { data } = await api.post(`/match/${matchId}/review/`, { answers })
  return data
}

// 마이페이지 보정 이력: 리뷰마다 프로필이 어떻게 움직였는지
export async function getReviewHistory(userId) {
  if (!isLive('review/history')) {
    await sleep(200)
    const seeded = [
      { matchId: 'h2', date: '2026-08-28', restaurant: '나폴리 화덕피자', deltas: { openness: 0.2, conscientiousness: 0, extraversion: -0.3, agreeableness: 0.1, neuroticism: 0 }, diversityPref: 0.4, driftAlert: false },
      { matchId: 'h1', date: '2026-09-12', restaurant: '온기설렁탕', deltas: { openness: 0.5, conscientiousness: 0, extraversion: 0.3, agreeableness: 0.3, neuroticism: -0.1 }, diversityPref: 0.6, driftAlert: true },
    ]
    const mine = Object.entries(getMockReviews()).map(([matchId, r]) => ({
      matchId,
      date: r.submittedAt.slice(0, 10),
      restaurant: '최근 식사',
      deltas: r.deltas,
      diversityPref: r.diversityPref,
      driftAlert: r.driftAlert,
    }))
    return [...seeded, ...mine].sort((a, b) => new Date(b.date) - new Date(a.date))
  }
  const { data } = await api.get(`/users/${userId}/reviews/`)
  return data
}

function clip(d) {
  return Math.max(-0.5, Math.min(0.5, d))
}
