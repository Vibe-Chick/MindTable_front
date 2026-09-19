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
export const GOOGLE_LIVE = isLive('auth/google')

// mock 로그인 (백엔드 없이)
export async function loginWithGoogle() {
  await sleep(700)
  let user = getMockUsers().find((u) => u.provider === 'google')
  if (!user) {
    user = saveMockUser(newUser({ email: 'jaebin@gmail.com', name: '이재빈' }))
  }
  return { token: `mock-${user.id}`, user }
}

// Google 공식 버튼을 el 안에 렌더링. 사용자가 누르면 팝업 → credential → onCredential(credential)
// One Tap(prompt)은 브라우저 상태에 따라 안 뜨는 경우가 많아 버튼 방식으로 고정한다.
// initialize()는 페이지당 한 번만 호출해야 한다 (여러 번 부르면 GSI 경고 + 마지막 인스턴스만 유효).
// 로그인 화면을 다시 열 때마다 콜백만 갈아끼우도록 모듈 변수에 보관한다.
let gsiInitialized = false
let onCredentialRef = null

export async function renderGoogleButton(el, onCredential) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google 클라이언트 ID(VITE_GOOGLE_CLIENT_ID)가 설정되지 않았어요')
  await loadGoogleSdk()
  onCredentialRef = onCredential
  if (!gsiInitialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (res) => res.credential && onCredentialRef?.(res.credential),
      ux_mode: 'popup',
    })
    gsiInitialized = true
  }
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.min(el.clientWidth || 360, 400),
    locale: 'ko',
  })
}

// Google credential(ID 토큰) → 백엔드 → 우리 서비스 토큰
export async function exchangeGoogleCredential(credential) {
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
  const sv = u.school_verification // 백엔드 SchoolVerification (있으면 인증된 것)
  return newUser({
    ...carry,
    id: u.id,
    email: u.email,
    name: u.name || carry.name || u.email.split('@')[0],
    picture: u.picture ?? null,
    googleId: u.google_id ?? null,
    schoolVerified: u.school_verified ?? (sv ? true : undefined) ?? carry.schoolVerified ?? false,
    hasProfile: u.has_profile ?? u.hasProfile ?? carry.hasProfile ?? false,
    school: sv?.school_name || u.school || carry.school || null,
    major: u.major ?? carry.major ?? null,
    univEmail: sv?.school_email ?? u.univ_email ?? carry.univEmail ?? null,
  })
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
// 백엔드(MindTable_back accounts):
//   POST /api/auth/school/send-code/    { school_email }            토큰 필요 → 인증 메일 발송
//   POST /api/auth/school/verify-code/  { school_email, code, school_name }  토큰 필요 → SchoolVerification 생성
// 사용자 식별은 Authorization 헤더의 JWT로 하므로 userId 는 보내지 않는다.
export async function requestSchoolCode(userId, univEmail) {
  if (!isUniversityEmail(univEmail)) {
    throw new Error('대학 이메일(.ac.kr / .edu)만 인증할 수 있어')
  }
  if (!isLive('auth/school')) {
    await sleep(500)
    if (getMockUsers().some((u) => u.univEmail === univEmail && u.id !== userId)) {
      throw new Error('이미 다른 계정에서 인증된 학교 이메일이에요')
    }
    return { school: guessSchoolFromEmail(univEmail) }
  }
  const { data } = await api.post('/auth/school/send-code/', { school_email: univEmail })
  // 백엔드가 학교명을 주면 쓰고, 없으면 도메인으로 추정
  return { school: data?.school_name ?? guessSchoolFromEmail(univEmail), message: data?.message }
}

export async function verifySchoolCode(userId, { univEmail, code, school, major }) {
  if (!isLive('auth/school')) {
    await sleep(500)
    if (code !== MOCK_CODE) throw new Error('인증 코드가 일치하지 않아요')
    const user = getMockUsers().find((u) => u.id === userId)
    return saveMockUser({ ...user, schoolVerified: true, univEmail, school, major })
  }
  const { data } = await api.post('/auth/school/verify-code/', { school_email: univEmail, code, school_name: school, major })
  // 응답 형식이 확정되기 전이라 있는 필드만 쓰고, 나머지는 입력값으로 채운다
  const v = data?.school_verification ?? data ?? {}
  const current = loadJson(USER_KEY) ?? {}
  return {
    ...current,
    schoolVerified: true,
    univEmail: v.school_email ?? univEmail,
    school: v.school_name || school,
    major: v.major ?? major,
    schoolVerifiedAt: v.verified_at ?? new Date().toISOString(),
  }
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
