import api, { USE_MOCK } from './api'
import { sleep, loadJson, saveJson, isUniversityEmail, guessSchoolFromEmail } from '../utils'

const USERS_KEY = 'mt_mock_users'
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

function publicUser(user) {
  const { password, ...rest } = user
  return rest
}

function newUser(fields) {
  return {
    id: Date.now(),
    provider: 'email', // 'email' | 'kakao'
    schoolVerified: false,
    univEmail: null,
    school: null,
    major: null,
    hasProfile: false,
    createdAt: new Date().toISOString(),
    ...fields,
  }
}

// ---------- 이메일 회원가입 ----------
export async function signup({ email, password, name }) {
  if (USE_MOCK) {
    await sleep(500)
    if (getMockUsers().some((u) => u.email === email)) {
      throw new Error('이미 가입된 이메일이에요')
    }
    return publicUser(saveMockUser(newUser({ email, password, name })))
  }
  const { data } = await api.post('/auth/signup', { email, password, name })
  return data
}

// ---------- 이메일 로그인 ----------
export async function login({ email, password }) {
  if (USE_MOCK) {
    await sleep(500)
    const user = getMockUsers().find((u) => u.email === email && u.password === password)
    if (!user) throw new Error('아이디 또는 비밀번호가 올바르지 않아요')
    return { token: `mock-${user.id}`, user: publicUser(user) }
  }
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

// ---------- 카카오 로그인 ----------
// 실제 연동: 카카오 SDK로 인가 코드를 받아 /oauth/kakao 로 리다이렉트 → 백엔드가 토큰 교환
export async function loginWithKakao() {
  if (USE_MOCK) {
    await sleep(700)
    let user = getMockUsers().find((u) => u.provider === 'kakao')
    if (!user) {
      user = saveMockUser(newUser({ provider: 'kakao', email: 'kakao_user@kakao.local', name: '카카오 사용자' }))
    }
    return { token: `mock-${user.id}`, user: publicUser(user) }
  }
  await loadKakaoSdk()
  window.Kakao.Auth.authorize({ redirectUri: `${window.location.origin}/oauth/kakao` })
  return new Promise(() => {}) // 페이지가 카카오로 이동하므로 resolve되지 않음
}

// 카카오 리다이렉트 콜백에서 인가 코드를 백엔드로 전달
export async function exchangeKakaoCode(code) {
  const { data } = await api.post('/auth/kakao', { code })
  return data
}

function loadKakaoSdk() {
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key) throw new Error('카카오 앱 키(VITE_KAKAO_JS_KEY)가 설정되지 않았어요')
  if (window.Kakao?.isInitialized()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    script.onload = () => {
      window.Kakao.init(key)
      resolve()
    }
    script.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'))
    document.head.appendChild(script)
  })
}

// ---------- 학교 인증 (대학 이메일) ----------
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
    return publicUser(saveMockUser({ ...user, schoolVerified: true, univEmail, school, major }))
  }
  const { data } = await api.post('/auth/school/verify', { userId, univEmail, code, school, major })
  return data
}

// ---------- 비밀번호 찾기 ----------
export async function requestPasswordCode(email) {
  if (USE_MOCK) {
    await sleep(500)
    const user = getMockUsers().find((u) => u.email === email)
    if (!user) throw new Error('가입되지 않은 이메일이에요')
    if (user.provider === 'kakao') throw new Error('카카오로 가입한 계정이에요. 카카오 로그인을 이용해줘')
    return { ok: true }
  }
  const { data } = await api.post('/auth/password/code', { email })
  return data
}

export async function verifyPasswordCode(email, code) {
  if (USE_MOCK) {
    await sleep(400)
    if (code !== MOCK_CODE) throw new Error('인증 코드가 일치하지 않아요')
    return { ok: true }
  }
  const { data } = await api.post('/auth/password/verify', { email, code })
  return data
}

export async function resetPassword(email, newPassword) {
  if (USE_MOCK) {
    await sleep(400)
    const user = getMockUsers().find((u) => u.email === email)
    saveMockUser({ ...user, password: newPassword })
    return { ok: true }
  }
  const { data } = await api.post('/auth/password/reset', { email, newPassword })
  return data
}

// ---------- 내 정보 수정 ----------
export async function updateProfile(userId, patch) {
  if (USE_MOCK) {
    await sleep(300)
    const user = getMockUsers().find((u) => u.id === userId)
    return publicUser(saveMockUser({ ...user, ...patch }))
  }
  const { data } = await api.patch(`/users/${userId}`, patch)
  return data
}
