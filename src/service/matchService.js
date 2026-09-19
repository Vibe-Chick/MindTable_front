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

// 매칭 신청 (대기자 풀에 등록)
export async function requestMatch(userId) {
  if (USE_MOCK) {
    await sleep(400)
    return { matchId: 'match-1', status: 'queued' }
  }
  const { data } = await api.post('/match/request', { userId })
  return data
}

// 매칭 진행 상태/결과 조회
export async function getMatchResult(matchId) {
  if (USE_MOCK) {
    await sleep(2500)
    return { status: 'done', result: MOCK_RESULT }
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
