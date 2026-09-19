export function formatDate(date) {
  return new Intl.DateTimeFormat('ko-KR').format(new Date(date))
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// 대학 이메일(.ac.kr / .edu)인지 확인 — 대학(원)생 인증용
export function isUniversityEmail(email) {
  return /\.(ac\.kr|edu)$/i.test(email)
}

export function isValidPassword(password) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 문자열 값을 그대로 쓰지 않고 로컬스토리지 JSON 파싱을 안전하게 처리
export function loadJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}
