import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/AuthContext'
import Landing from './pages/Landing/Landing'
import Login from './pages/Login/Login'
import Signup from './pages/Signup/Signup'
import FindPassword from './pages/FindPassword/FindPassword'
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 플로우 */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/find-password" element={<FindPassword />} />

        {/* 인증 후 */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<Home />} />
          <Route path="/test" element={<PsychTest />} />
          <Route path="/matching" element={<Matching />} />
          <Route path="/matching/result" element={<MatchResult />} />
          <Route path="/restaurants" element={<Restaurants />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/mypage" element={<MyPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
