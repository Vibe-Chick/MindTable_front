import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import Landing from './pages/Landing/Landing'
import Login from './pages/Login/Login'
import VerifySchool from './pages/VerifySchool/VerifySchool'
import Home from './pages/Home/Home'
import PsychTest from './pages/PsychTest/PsychTest'
import Matching from './pages/Matching/Matching'
import MatchResult from './pages/MatchResult/MatchResult'
import Restaurants from './pages/Restaurants/Restaurants'
import Subscription from './pages/Subscription/Subscription'
import Review from './pages/Review/Review'
import MyPage from './pages/MyPage/MyPage'

// 로그인이 필요한 라우트 보호 — 세션 없으면 첫 화면(Landing)으로
function RequireAuth() {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <Outlet /> : <Navigate to="/" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 플로우 */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* 로그인만 하면 전부 이용 가능. 학교 인증은 선택(같은 학교 매칭 옵션) */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<Home />} />
          <Route path="/test" element={<PsychTest />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/verify-school" element={<VerifySchool />} />
          <Route path="/matching" element={<Matching />} />
          <Route path="/matching/result" element={<MatchResult />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/review/:matchId" element={<Review />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
