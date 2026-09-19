# MindTable (frontend)

AI 기반 랜덤 식사 매칭 서비스 — 다른 학교 · 다른 전공 대학(원)생을 Big Five 성향 분석으로 이어주고, 제휴 식당까지 추천합니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

`.env`의 `VITE_USE_MOCK=true`면 백엔드 없이 mock 데이터(localStorage)로 전체 플로우가 동작합니다.
백엔드 연동 시 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL`을 서버 주소로 바꾸면 됩니다.

## 스택

- React 19 + Vite 8, React Router 7
- CSS Modules(컴포넌트) + Tailwind CSS v4(유틸리티)
- axios, Context API

## 구조

```
src/
  components/   Layout(모바일 프레임), ui(Button/Input/Card 등 공용 UI)
  pages/        라우트 단위 화면 (PascalCase 폴더 + .module.css)
  service/      api.js(axios 인스턴스) + 도메인별 API/mock
  store/        AuthContext(로그인), MatchContext(테스트 답변·매칭 결과)
  utils/        유효성 검사 등 순수 함수
```

## 화면 플로우

| 경로 | 화면 | 플로우차트 |
|---|---|---|
| `/` | 초기 화면 (로그인 / 회원가입 분기) | 로그인 플로우 |
| `/login` `/signup` `/find-password` | 로그인 · 회원가입(대학 이메일 검증) · 비밀번호 찾기(코드 인증) | 로그인 플로우 |
| `/home` | 메인 (매칭 신청 진입) | — |
| `/test` | 심리 테스트 (개방형 3 + 강제선택 1 → AI 분석 → 프로필 저장/재요청) | 심리 테스트 |
| `/matching` → `/matching/result` | 매칭 파이프라인 로딩 → 그룹 · 매칭 이유 · 아이스브레이커 | 매칭 시스템 |
| `/restaurants` | 제휴 식당 추천 · 예약 | 식당 추천 |
| `/subscription` | 무료 매칭 소진 후 구독 유도 | 수익 모델 |
| `/mypage` | 계정 설정 · 개인 설정 · 통계/매칭 기록 | 마이페이지 플로우 |

첫 로그인(프로필 없음)은 `/test`로, 이후 로그인은 `/home`으로 이동합니다.
