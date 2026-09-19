import api, { USE_MOCK } from './api'
import { sleep, saveJson } from '../utils'

// 기본 질문 3개 (Big Five 기반, 개방형). 4번째는 답변이 애매할 때만 AI가 꼬리 질문으로 생성한다.
// 실서버: 백엔드가 문항마다 LLM으로 질문 1개를 생성해 내려준다 (generateQuestion). 질문 id 는 백엔드가 내부에서 관리하므로
// 프론트는 id 를 주고받지 않고, 질문 문자열과 답변만 보낸다. 아래 상수는 mock 모드용 예시.
export const QUESTION_COUNT = 3
export const QUESTION_HINT = '정답은 없어, 최근 예시 들어서 편하게 적어줘'
const MOCK_QUESTIONS = [
  '낯선 사람들이랑 있을 때랑 혼자 있을 때,\n에너지가 언제 더 차오르는 편이야?',
  '요즘 새롭게 관심 생긴 주제나\n낯선 경험 있었어?',
  '낯선 사람들이랑 대화하다가 어색해지면\n보통 어떻게 풀어가는 편이야?',
]

// ---------- 질문 생성 ----------
// 문항마다 1회 호출. 백엔드가 LLM 으로 질문 1개를 만들어 내려준다 (호출할 때마다 다른 질문).
// index 는 mock 에서만 쓴다 (실서버는 백엔드가 순서를 관리).
export async function generateQuestion(index = 0) {
  if (USE_MOCK) {
    await sleep(400)
    return MOCK_QUESTIONS[index % MOCK_QUESTIONS.length]
  }
  const { data } = await api.post('/psychology/questions/', {})
  // 명세: { questions: '문자열' }. 백엔드가 아직 배열([{ title }])을 주는 동안엔 index 번째 문항을 꺼낸다
  const q = data.questions
  if (Array.isArray(q)) return q[index]?.title ?? q[0]?.title ?? ''
  return q
}

// ---------- 문항별 답변 확인 ----------
// 프론트는 비어 있는지만 본다. 답변 품질(길이·내용·회피성)은 전부 백엔드 LLM(check-answer)이 판단한다.
// 반환: { ok, reason }  (reason은 사용자에게 보여줄 문구)
export function checkAnswerLocally(question, answer) {
  if (question.type === 'choice') {
    return answer ? { ok: true } : { ok: false, reason: '하나를 골라줘' }
  }
  return (answer ?? '').trim() ? { ok: true } : { ok: false, reason: '답변을 적어줘' }
}

// 문항별 품질 검사 (비어 있으면 바로 반려, 아니면 서버/LLM 판단)
// 실서버: LLM이 "성향을 읽을 만한 내용이 있는가"를 판단하고, 애매하면 꼬리 질문을 같이 만들어 준다
// 꼬리 질문은 테스트당 최대 1개 → 화면에서는 4번째 문항으로 보인다 (PsychTest 에서 제한)
// 반환: { ok, reason?, followUpQuestion? }
//   ok=false          → reason 을 띄우고 같은 문항 다시 작성
//   followUpQuestion  → 같은 화면에 꼬리 질문을 띄우고 답을 받은 뒤 다음 문항으로
export async function checkAnswerQuality(question, answer) {
  const local = checkAnswerLocally(question, answer)
  if (!local.ok) return local
  if (question.type === 'choice') return { ok: true }
  if (USE_MOCK) {
    await sleep(500)
    // mock: 백엔드와 같은 규칙 — 15자 미만이면 꼬리 질문 (4번째 문항 테스트용)
    const short = answer.trim().length < 15
    return { ok: true, followUpQuestion: short ? `조금만 더 듣고 싶어. "${answer.trim().slice(0, 12)}…" 이럴 때 보통 어떤 기분이야?` : null }
  }
  const { data } = await api.post('/psychology/check-answer/', {
    question: question.title,
    answer,
  })
  // { needFollowUp, followUpQuestion }
  return { ok: true, followUpQuestion: data.needFollowUp && data.followUpQuestion ? data.followUpQuestion : null }
}

// 전송 전 빈 답변 재확인 (문항별 검사를 우회해 도달한 경우 대비)
export function validateAnswers(questions, answers) {
  const insufficient = questions.filter((q) => !checkAnswerLocally(q, answers[q.id]).ok).map((q) => q.id)
  return { ok: insufficient.length === 0, insufficient }
}

// AI(LLM)가 답변 → Big Five 5축 점수 + 관심사 키워드 3개 추출
// 기본 질문 답변은 check-answer 때 백엔드가 저장해 두므로 다시 보내지 않는다.
// userEmail:  user_id 로 전송 (백엔드 명세: 이메일)
// followUps:  [{ questionId, question, answer }]  꼬리 질문 (최대 1개)
// answers:    mock 계산용 [{ question, answer }] — 실서버엔 보내지 않음
// valid=false면 insufficient에 다시 써야 할 문항 id(q1…) 또는 index(0부터)가 담겨 온다
export async function analyzeAnswers(userEmail, followUps = [], answers = []) {
  if (USE_MOCK) {
    await sleep(2200)
    const text = answers.map((a) => a.answer).join(' ')
    const long = text.length > 80
    return {
      bigFive: {
        openness: long ? 4 : 3,
        conscientiousness: 3,
        extraversion: long ? 4 : 2,
        agreeableness: 3,
        neuroticism: 2,
      },
      interests: ['필름카메라', '클라이밍', '전시 보기'],
      summary: '낯가림은 있지만 얘기 시작하면 잘 안 멈추는 타입',
      valid: true,
      insufficient: [],
    }
  }
  const { data } = await api.post('/psychology/analyze/', { user_id: userEmail, followUps })
  return data
}

export async function saveProfileVector(userId, profile) {
  if (USE_MOCK) {
    await sleep(300)
    saveJson('mt_profile', profile) // 마이페이지 '첫 테스트 → 지금' 비교 기준
    return { ok: true }
  }
  const { data } = await api.post(`/users/${userId}/profile`, profile)
  return data
}
