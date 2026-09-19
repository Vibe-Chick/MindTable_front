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
import MyPage from './pages/MyPage/MyPage'

// 로그인이 필요한 라우트 보호
function RequireAuth() {
  const { isLoggedIn } = useAuth()
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace />
}

// 학교 인증한 사용자만 쓸 수 있는 라우트 (매칭 · 식당 · 구독)
function RequireVerified() {
  const { user } = useAuth()
  return user.schoolVerified ? <Outlet /> : <Navigate to="/verify-school?reason=gated" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 플로우 */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* 로그인만 하면 이용 가능 */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<Home />} />
          <Route path="/test" element={<PsychTest />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/verify-school" element={<VerifySchool />} />

          {/* 학교 인증한 사용자만 이용 가능 */}
          <Route element={<RequireVerified />}>
            <Route path="/matching" element={<Matching />} />
            <Route path="/matching/result" element={<MatchResult />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/subscription" element={<Subscription />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
