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
const MIN_WORDS = 3

// 회피성 답변 — 짧은 답변에 이런 표현만 있으면 성향을 뽑을 수 없다
const EVASIVE = ['몰라', '모르겠', '딱히', '그냥', '없음', '없어', '없다', '글쎄', '비밀', '패스', '생각 안', '생각안']

// ---------- 문항별 답변 품질 검사 ----------
// "다음"을 누를 때마다 호출. 통과 못 하면 그 자리에서 다시 쓰게 한다.
// 반환: { ok, reason }  (reason은 사용자에게 보여줄 문구)
export function checkAnswerLocally(question, answer) {
  if (question.type === 'choice') {
    return answer ? { ok: true } : { ok: false, reason: '하나를 골라줘' }
  }
  const text = (answer ?? '').trim()
  if (text.length < MIN_ANSWER_LENGTH) {
    return { ok: false, reason: `조금만 더 적어줄래? (${text.length}/${MIN_ANSWER_LENGTH}자)` }
  }
  // 완성형 한글 음절이나 영단어가 거의 없으면 (ㅋㅋㅋ, ㅇㅇ, ... 등) 무효
  const meaningful = (text.match(/[가-힣a-zA-Z]/g) ?? []).length
  if (meaningful < MIN_ANSWER_LENGTH * 0.6) {
    return { ok: false, reason: '문장으로 적어줘야 성향을 읽을 수 있어' }
  }
  // 같은 글자 반복 (예: "아아아아아아아아아")
  const uniqueRatio = new Set(text.replace(/\s/g, '')).size / text.replace(/\s/g, '').length
  if (uniqueRatio < 0.3) {
    return { ok: false, reason: '같은 글자만 반복된 것 같아. 실제 경험을 적어줘' }
  }
  if (text.split(/\s+/).length < MIN_WORDS) {
    return { ok: false, reason: '단어 몇 개보다는 짧은 문장으로 적어줘' }
  }
  // 짧은 회피성 답변 ("잘 몰라요", "딱히 없어요")
  if (text.length < 30 && EVASIVE.some((w) => text.includes(w))) {
    return { ok: false, reason: '없으면 없는 이유나 비슷한 경험이라도 적어줘. 그게 더 도움이 돼' }
  }
  return { ok: true }
}

// 문항별 품질 검사 (로컬 규칙 → 통과하면 서버/LLM 판단)
// 실서버: LLM이 "질문에 대한 답인가, 성향을 읽을 만한 내용이 있는가"를 판단
export async function checkAnswerQuality(question, answer) {
  const local = checkAnswerLocally(question, answer)
  if (!local.ok) return local
  if (USE_MOCK) {
    await sleep(500)
    return { ok: true }
  }
  const { data } = await api.post('/profile/check-answer', {
    questionId: question.id,
    trait: question.trait,
    question: question.title,
    answer,
  })
  return data // { ok, reason }
}

// 전송 전 전체 답변 재검사 (문항별 검사를 우회해 도달한 경우 대비)
export function validateAnswers(answers) {
  const insufficient = QUESTIONS.filter((q) => !checkAnswerLocally(q, answers[q.id]).ok).map((q) => q.id)
  return { ok: insufficient.length === 0, insufficient }
}

// AI(LLM)가 답변 → Big Five 5축 점수 + 관심사 키워드 3개 추출
// valid=false면 insufficient에 다시 써야 할 문항 id가 담겨 온다
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
      insufficient: [],
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
