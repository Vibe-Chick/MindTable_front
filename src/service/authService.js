import api, { USE_MOCK } from './api'
import { sleep, loadJson, saveJson } from '../utils'

const USERS_KEY = 'mt_mock_users'

// ---------- mock helpers ----------
function getMockUsers() {
  return loadJson(USERS_KEY, [])
}

function publicUser(user) {
  const { password, ...rest } = user
  return rest
}

// ---------- 회원가입 ----------
export async function signup({ email, password, name, school, major }) {
  if (USE_MOCK) {
    await sleep(500)
    const users = getMockUsers()
    if (users.some((u) => u.email === email)) {
      throw new Error('이미 가입된 이메일이에요')
    }
    const user = {
      id: Date.now(),
      email,
      password,
      name,
      school,
      major,
      hasProfile: false,
      createdAt: new Date().toISOString(),
    }
    saveJson(USERS_KEY, [...users, user])
    return publicUser(user)
  }
  const { data } = await api.post('/auth/signup', { email, password, name, school, major })
  return data
}

// ---------- 로그인 ----------
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

// ---------- 비밀번호 찾기 ----------
export async function requestPasswordCode(email) {
  if (USE_MOCK) {
    await sleep(500)
    if (!getMockUsers().some((u) => u.email === email)) {
      throw new Error('가입되지 않은 이메일이에요')
    }
    return { code: '123456' } // mock: 항상 123456
  }
  const { data } = await api.post('/auth/password/code', { email })
  return data
}

export async function verifyPasswordCode(email, code) {
  if (USE_MOCK) {
    await sleep(400)
    if (code !== '123456') throw new Error('인증 코드가 일치하지 않아요')
    return { ok: true }
  }
  const { data } = await api.post('/auth/password/verify', { email, code })
  return data
}

export async function resetPassword(email, newPassword) {
  if (USE_MOCK) {
    await sleep(400)
    const users = getMockUsers().map((u) =>
      u.email === email ? { ...u, password: newPassword } : u,
    )
    saveJson(USERS_KEY, users)
    return { ok: true }
  }
  const { data } = await api.post('/auth/password/reset', { email, newPassword })
  return data
}

// ---------- 내 정보 수정 ----------
export async function updateProfile(userId, patch) {
  if (USE_MOCK) {
    await sleep(300)
    const users = getMockUsers().map((u) => (u.id === userId ? { ...u, ...patch } : u))
    saveJson(USERS_KEY, users)
    return publicUser(users.find((u) => u.id === userId))
  }
  const { data } = await api.patch(`/users/${userId}`, patch)
  return data
}
