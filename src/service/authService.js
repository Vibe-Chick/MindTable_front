import api, { USE_MOCK, isLive } from './api'
import { sleep, loadJson, saveJson, isUniversityEmail, guessSchoolFromEmail } from '../utils'

const USERS_KEY = 'mt_mock_users'
const USER_KEY = 'mt_user'
const MOCK_CODE = '123456' // mock: 모든 인증 코드는 123456

// ---------- mock helpers ----------
function getMockUsers() {
  return loadJson(USERS_KEY, [])
}

function saveMockUser(user) {
  const users = getMockUsers()
  const idx = users.findIndex((u) => u.id === user.id)
  if (idx >= 0) users[idx] = user
  else users.push(user)
  saveJson(USERS_KEY, users)
  return user
}

function newUser(fields) {
  return {
    id: Date.now(),
    provider: 'google',
    schoolVerified: false, // 학교 인증 여부 — 매칭/식당/구독은 인증한 사용자만
    univEmail: null,
    school: null,
    major: null,
    hasProfile: false,
    createdAt: new Date().toISOString(),
    ...fields,
  }
}

// ---------- Google 로그인 (유일한 로그인 수단) ----------
// 실제 연동: Google Identity Services로 ID 토큰(credential)을 받아 백엔드 POST /api/auth/google/ 에 전달
//
// 백엔드 응답 (MindTable_back accounts/views.py):
//   { access, refresh, user: { id, email, name, picture, google_id }, created }
// 프론트 형식으로 매핑:
//   { token: access, refresh, user: { ...프론트 user 필드 } }
export async function loginWithGoogle() {
  if (!isLive('auth/google')) {
    await sleep(700)
    let user = getMockUsers().find((u) => u.provider === 'google')
    if (!user) {
      user = saveMockUser(newUser({ email: 'jaebin@gmail.com', name: '이재빈' }))
    }
    return { token: `mock-${user.id}`, user }
  }
  const credential = await getGoogleCredential()
  const { data } = await api.post('/auth/google/', { credential })
  return {
    token: data.access,
    refresh: data.refresh,
    user: normalizeBackendUser(data.user),
  }
}

// 백엔드 user → 프론트 user. 백엔드에 아직 없는 필드(schoolVerified, hasProfile 등)는
// 같은 이메일로 이 브라우저에 저장돼 있던 값을 이어받고, 없으면 기본값을 쓴다.
function normalizeBackendUser(u) {
  const prev = loadJson(USER_KEY)
  const carry = prev && prev.email === u.email ? prev : {}
  return newUser({
    ...carry,
    id: u.id,
    email: u.email,
    name: u.name || carry.name || u.email.split('@')[0],
    picture: u.picture ?? null,
    googleId: u.google_id ?? null,
    schoolVerified: u.school_verified ?? u.schoolVerified ?? carry.schoolVerified ?? false,
    hasProfile: u.has_profile ?? u.hasProfile ?? carry.hasProfile ?? false,
    school: u.school ?? carry.school ?? null,
    major: u.major ?? carry.major ?? null,
    univEmail: u.univ_email ?? u.univEmail ?? carry.univEmail ?? null,
  })
}

function getGoogleCredential() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google 클라이언트 ID(VITE_GOOGLE_CLIENT_ID)가 설정되지 않았어요')

  return loadGoogleSdk().then(
    () =>
      new Promise((resolve, reject) => {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => (res.credential ? resolve(res.credential) : reject(new Error('Google 로그인이 취소됐어요'))),
        })
        window.google.accounts.id.prompt((n) => {
          if (n.isNotDisplayed() || n.isSkippedMoment()) reject(new Error('Google 로그인 창을 열 수 없어요. 팝업 차단을 확인해줘'))
        })
      }),
  )
}

function loadGoogleSdk() {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Google SDK를 불러오지 못했어요'))
    document.head.appendChild(script)
  })
}

// ---------- 학교 인증 (선택) — 대학 이메일 코드 인증 ----------
export async function requestSchoolCode(userId, univEmail) {
  if (!isUniversityEmail(univEmail)) {
    throw new Error('대학 이메일(.ac.kr / .edu)만 인증할 수 있어')
  }
  if (USE_MOCK) {
    await sleep(500)
    if (getMockUsers().some((u) => u.univEmail === univEmail && u.id !== userId)) {
      throw new Error('이미 다른 계정에서 인증된 학교 이메일이에요')
    }
    return { school: guessSchoolFromEmail(univEmail) }
  }
  const { data } = await api.post('/auth/school/code', { userId, univEmail })
  return data
}

export async function verifySchoolCode(userId, { univEmail, code, school, major }) {
  if (USE_MOCK) {
    await sleep(500)
    if (code !== MOCK_CODE) throw new Error('인증 코드가 일치하지 않아요')
    const user = getMockUsers().find((u) => u.id === userId)
    return saveMockUser({ ...user, schoolVerified: true, univEmail, school, major })
  }
  const { data } = await api.post('/auth/school/verify', { userId, univEmail, code, school, major })
  return data
}

// ---------- 내 정보 수정 ----------
export async function updateProfile(userId, patch) {
  if (USE_MOCK) {
    await sleep(300)
    const user = getMockUsers().find((u) => u.id === userId)
    return saveMockUser({ ...user, ...patch })
  }
  const { data } = await api.patch(`/users/${userId}`, patch)
  return data
}
