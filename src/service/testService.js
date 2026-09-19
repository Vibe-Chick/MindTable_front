import api, { USE_MOCK } from './api'
import { sleep } from '../utils'

// 개방형 3문항 + 강제선택 1문항 (Big Five 기반 설문)
export const QUESTIONS = [
  {
    id: 'q1',
    type: 'open',
    trait: 'extraversion',
    title: '낯선 사람들이랑 있을 때랑 혼자 있을 때,\n에너지가 언제 더 차오르는 편이야?',
    hint: '정답은 없어, 최근 예시 들어서 편하게 적어줘',
  },
  {
    id: 'q2',
    type: 'open',
    trait: 'openness',
    title: '요즘 새롭게 관심 생긴 주제나\n낯선 경험 있었어?',
    hint: '아주 작은 거라도 좋아. 왜 끌렸는지도 알려줘',
  },
  {
    id: 'q3',
    type: 'open',
    trait: 'agreeableness',
    title: '낯선 사람들이랑 대화하다가 어색해지면\n보통 어떻게 풀어가는 편이야?',
    hint: '너만의 대화 스타일이 궁금해',
  },
  {
    id: 'q4',
    type: 'choice',
    trait: 'calibration',
    title: '마지막으로, 그룹 안에 있을 때\n나는 어느 쪽에 더 가까워?',
    hint: '정답 없어, 더 편한 쪽으로 골라줘',
    options: [
      { value: 'leader', emoji: '🎤', label: '이끄는 역할이 편해' },
      { value: 'harmonizer', emoji: '🌿', label: '분위기 맞추는 게 편해' },
    ],
  },
]

const MIN_ANSWER_LENGTH = 10

// 답변이 AI 분석에 충분한지 클라이언트 측 검증
export function validateAnswers(answers) {
  return QUESTIONS.every((q) => {
    const a = answers[q.id]
    if (q.type === 'choice') return Boolean(a)
    return typeof a === 'string' && a.trim().length >= MIN_ANSWER_LENGTH
  })
}

// AI(LLM)가 답변 → Big Five 5축 점수 + 관심사 키워드 3개 추출
export async function analyzeAnswers(answers) {
  if (USE_MOCK) {
    await sleep(2200)
    const text = Object.values(answers).join(' ')
    const long = text.length > 80
    return {
      bigFive: {
        openness: long ? 4 : 3,
        conscientiousness: 3,
        extraversion: answers.q4 === 'leader' ? 4 : 2,
        agreeableness: answers.q4 === 'harmonizer' ? 4 : 3,
        neuroticism: 2,
      },
      interests: ['필름카메라', '클라이밍', '전시 보기'],
      summary: '낯가림은 있지만 얘기 시작하면 잘 안 멈추는 타입',
      valid: true,
    }
  }
  const { data } = await api.post('/profile/analyze', { answers })
  return data
}

export async function saveProfileVector(userId, profile) {
  if (USE_MOCK) {
    await sleep(300)
    return { ok: true }
  }
  const { data } = await api.post(`/users/${userId}/profile`, profile)
  return data
}
