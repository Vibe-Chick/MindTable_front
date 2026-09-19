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

// 대학 이메일 도메인 → 학교명 추정 (없으면 null, 사용자가 직접 입력)
const SCHOOL_DOMAINS = {
  'hanyang.ac.kr': '한양대학교',
  'snu.ac.kr': '서울대학교',
  'yonsei.ac.kr': '연세대학교',
  'korea.ac.kr': '고려대학교',
  'ewha.ac.kr': '이화여자대학교',
  'ewhain.net': '이화여자대학교',
  'konkuk.ac.kr': '건국대학교',
  'sch.ac.kr': '순천향대학교',
  'skku.edu': '성균관대학교',
  'kaist.ac.kr': 'KAIST',
  'postech.ac.kr': 'POSTECH',
  'sogang.ac.kr': '서강대학교',
  'cau.ac.kr': '중앙대학교',
  'khu.ac.kr': '경희대학교',
  'hufs.ac.kr': '한국외국어대학교',
  'uos.ac.kr': '서울시립대학교',
  'sejong.ac.kr': '세종대학교',
  'dongguk.edu': '동국대학교',
  'hongik.ac.kr': '홍익대학교',
  'kookmin.ac.kr': '국민대학교',
  'inha.ac.kr': '인하대학교',
  'ajou.ac.kr': '아주대학교',
  'pusan.ac.kr': '부산대학교',
  'knu.ac.kr': '경북대학교',
  'cnu.ac.kr': '충남대학교',
  'jnu.ac.kr': '전남대학교',
}

export function guessSchoolFromEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  // 서브도메인(mail.hanyang.ac.kr 등)도 매칭되도록 뒤에서부터 비교
  const hit = Object.keys(SCHOOL_DOMAINS).find((d) => domain === d || domain.endsWith(`.${d}`))
  return hit ? SCHOOL_DOMAINS[hit] : null
}

// 로그인/인증 상태에 따라 다음에 가야 할 화면
export function nextRouteFor(user) {
  if (!user) return '/login'
  if (!user.schoolVerified) return '/verify-school'
  if (!user.hasProfile) return '/test'
  return '/home'
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
