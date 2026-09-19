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
| `/login` | Google 계정 로그인 (유일한 로그인 수단, 별도 가입 없음) | 로그인 플로우 |
| `/verify-school` | 학교 인증(선택): 대학 이메일 코드 인증 → 학교(도메인 자동 추정)·전공 확정 | 로그인 플로우 |
| `/home` | 메인 (매칭 신청 진입) | — |
| `/test` | 심리 테스트 (개방형 3 + 강제선택 1 → AI 분석 → 프로필 저장/재요청) | 심리 테스트 |
| `/matching` → `/matching/result` | 테이블 만들기(날짜·시간은 목록 또는 달력, 인원 3~6) 또는 열린 테이블 참가(전체·AI 추천) → 정원 찰 때까지 대기 → 그룹 · 매칭 이유 · 아이스브레이커 | 매칭 시스템 |
| `/restaurants` | 그룹 조건(위치·예산) 입력 → 멤버 전원 제출 대기 → AI가 식당 한 곳 추천 (제휴 식당 / 지도 fallback) → 예약·확정 | 식당 추천 |
| `/subscription` | 무료 매칭 소진 후 구독 유도 | 수익 모델 |
| `/review/:matchId` | 테이블 리뷰 (자유서술 3 + 강제선택 1, 식사 2시간 후 ~ 24시간) → 프로필 변화 결과 | 보정 |
| `/mypage` | 계정 설정 · 알림 설정 · 내 프로필(첫 테스트 → 지금) · 테이블 리뷰 기록 | 마이페이지 플로우 |

## 사용자 구분: 학교 인증 여부

로그인 후 이동은 `nextRouteFor(user)` 기준: 성향 테스트 미완료 → `/test`, 완료 → `/home`. 학교 인증은 강제하지 않습니다.

| 구분 | 이용 가능 기능 |
|---|---|
| 로그인만 한 사용자 | 메인, AI 성향 테스트 · 결과, 마이페이지 · 통계 |
| 학교 인증한 사용자 | 위 전부 + 식사 매칭 신청 · 결과 · 아이스브레이커, 제휴 식당 추천 · 예약, 학기 구독 |

인증 전용 라우트는 `App.jsx`의 `RequireVerified`로 묶여 있고, 미인증 사용자가 접근하면 `/verify-school?reason=gated`로 안내됩니다.

## 백엔드 연동

`npm run dev`의 Vite 프록시가 `/api/*`를 `http://127.0.0.1:8000`(MindTable_back, Django)으로 전달합니다. CORS 설정 불필요.

`.env`:
```
VITE_USE_MOCK=true            # 기본은 mock
VITE_LIVE_APIS=auth/google    # 여기 적힌 API만 실제 백엔드로 (쉼표로 추가)
```
백엔드 API가 완성되는 순서대로 `VITE_LIVE_APIS`에 이름을 추가하면 됩니다. 전부 켜려면 `VITE_USE_MOCK=false`.

## Web Push 알림

앱을 닫아도 폰/PC 브라우저로 알림이 오는 방식. 마이페이지 → 알림 설정에서 켭니다.

- `public/sw.js` — 푸시 수신 → OS 알림 표시, 탭하면 해당 화면으로 이동
- `public/manifest.json` — PWA 설정. iPhone은 Safari에서 "홈 화면에 추가"한 뒤에만 푸시 가능 (설정 화면에서 안내)
- `src/service/pushService.js` — 권한 요청 → 서비스 워커 → `PushManager.subscribe(VAPID 공개키)` → `POST /push/subscribe/`
- mock 모드에서는 구독 없이 권한만 받고, 매칭 완료·장소 확정·리뷰 요청 시점에 프론트가 직접 OS 알림을 띄워 흐름을 확인할 수 있습니다 (`notifyLocal`)
- 실서버 전환: `.env`의 `VITE_VAPID_PUBLIC_KEY`에 백엔드가 만든 공개키를 넣고 `VITE_LIVE_APIS`에 `push/subscribe`를 추가

## Google 로그인 연동

`.env`의 `VITE_GOOGLE_CLIENT_ID`에 Google Cloud 콘솔의 OAuth 클라이언트 ID를 넣고 `VITE_USE_MOCK=false`로 두면,
Google Identity Services로 ID 토큰(credential)을 받아 백엔드 `POST /api/auth/google/ { credential }`에 넘깁니다.
백엔드 응답 `{ access, refresh, user }`는 `authService.js`의 `normalizeBackendUser`가 프론트 user 형식으로 매핑합니다.
백엔드 `.env`의 `GOOGLE_CLIENT_ID`와 같은 값이어야 합니다.
Google 콘솔의 승인된 JavaScript 원본에 `http://localhost:3000`을 등록해야 합니다.
