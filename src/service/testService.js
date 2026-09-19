import api, { USE_MOCK } from './api'
import { sleep, saveJson } from '../utils'

// 기본 질문 3개 (Big Five 기반, 개방형). 4번째는 답변이 애매할 때만 AI가 꼬리 질문으로 생성한다.
// 질문은 항상 백엔드가 LLM 으로 생성해 내려준다 (하드코딩 없음, mock 모드에서도 실서버 호출).
// 문항 id(q1·q2·q3)는 프론트가 순서대로 붙이고, check-answer / analyze 의 questionId 로 보낸다.
export const QUESTION_COUNT = 3
export const QUESTION_HINT = '정답은 없어, 최근 예시 들어서 편하게 적어줘'

// ---------- 질문 생성 ----------
// 문항마다 1회 호출. POST /psychology/questions/  {}  →  { question_number, question: '질문 문자열' }  (호출할 때마다 다른 질문)
// 명세서엔 `questions` 로 적혀 있지만 실제 백엔드는 `question` 으로 내려주므로 둘 다 받는다.
export async function generateQuestion() {
  const { data } = await api.post('/psychology/questions/', {})
  const title = data.question ?? data.questions
  if (!title) throw new Error('질문을 받지 못했어요. 잠시 후 다시 시도해줘')
  return title
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
// 꼬리 질문의 답변도 같은 API 로 보낸다 (questionId 'q1-f' 등) — 백엔드가 저장해 analyze 때 함께 쓴다
// 반환: { ok, reason?, followUpQuestion? }
//   ok=false          → reason 을 띄우고 같은 문항 다시 작성
//   followUpQuestion  → 같은 화면에 꼬리 질문을 띄우고 답을 받은 뒤 다음 문항으로
export async function checkAnswerQuality(question, answer) {
  const local = checkAnswerLocally(question, answer)
  if (!local.ok) return local
  if (question.type === 'choice') return { ok: true }
  // 명세: { questionId: 'q1', question, answer }
  const { data } = await api.post('/psychology/check-answer/', {
    questionId: question.id,
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
// 모든 답변(기본 3문항 + 꼬리 질문)은 check-answer 때 백엔드가 저장해 두므로 여기선 user_id 만 보낸다.
// 명세: { user_id: <이메일> }  →  { bigFive, interests, summary, valid, insufficient[] }
// valid=false면 insufficient에 다시 써야 할 문항 id(q1…) 또는 index(0부터)가 담겨 온다
export async function analyzeAnswers(userEmail) {
  const { data } = await api.post('/psychology/analyze/', { user_id: userEmail })
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
