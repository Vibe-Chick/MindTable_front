import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import PushSettings from '../../components/PushSettings/PushSettings'
import ProfileHistory from '../../components/ProfileHistory/ProfileHistory'
import { Button, Card, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { updateProfile } from '../../service/authService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import styles from './MyPage.module.css'

// 마이페이지: 계정 설정(정보 변경 / 개인 설정) · 통계 · 매칭 기록
function MyPage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()
  const { setMatch } = useMatch()
  const [tab, setTab] = useState('account') // account | stats
  const [form, setForm] = useState({ name: user.name })
  const [prefs, setPrefs] = useState({ autoMatch: false, sameSchoolFilter: false })
  const [saved, setSaved] = useState(false)
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const save = async () => {
    const next = await updateProfile(user.id, form)
    updateUser(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onLogout = () => {
    logout()
    setMatch(null)
    navigate('/', { replace: true })
  }

  return (
    <Layout title="마이페이지" showBack>
      <div className={styles.profile}>
        <div className={styles.avatar}>{user.name[0]}</div>
        <div>
          <div className={styles.name}>{user.name}</div>
          <div className={styles.meta}>
            {user.schoolVerified ? `🎓 ${user.school} · ${user.major}` : '학교 인증 전'}
          </div>
          <div className={styles.email}>{user.email}</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={tab === 'account' ? styles.tabOn : styles.tab} onClick={() => setTab('account')}>
          계정 설정
        </button>
        <button type="button" className={tab === 'stats' ? styles.tabOn : styles.tab} onClick={() => setTab('stats')}>
          내 프로필 · 리뷰
        </button>
      </div>

      {tab === 'account' && (
        <>
          {saved && <Notice tone="success">저장됐어요</Notice>}
          <h3 className={styles.section}>계정 정보 변경</h3>
          <Field label="이름">
            <Input name="name" value={form.name} onChange={onChange} />
          </Field>
          <Button variant="secondary" onClick={save}>
            정보 저장
          </Button>

          <h3 className={styles.section}>학교 인증</h3>
          <Card className={styles.prefs}>
            {user.schoolVerified ? (
              <div className={styles.pref}>
                <span>
                  <strong>{user.school} · {user.major}</strong>
                  <small>{user.univEmail} 로 인증됨</small>
                </span>
                <span className={styles.verified}>인증 완료</span>
              </div>
            ) : (
              <div className={styles.pref}>
                <span>
                  <strong>아직 인증 전이에요</strong>
                  <small>인증하면 같은 학교 사람과도 매칭될 수 있어</small>
                </span>
                <Button variant="secondary" full={false} onClick={() => navigate('/verify-school')}>
                  인증하기
                </Button>
              </div>
            )}
          </Card>

          <PushSettings />

          <h3 className={styles.section}>개인 설정</h3>
          <Card className={styles.prefs}>
            <label className={styles.pref}>
              <span>
                <strong>자동 매칭</strong>
                <small>매주 정해진 시각에 자동으로 매칭 신청</small>
              </span>
              <input type="checkbox" checked={prefs.autoMatch} onChange={(e) => setPrefs({ ...prefs, autoMatch: e.target.checked })} />
            </label>
            <label className={styles.pref}>
              <span>
                <strong>같은 학교 제외</strong>
                <small>{user.schoolVerified ? '다른 학교 학생과만 매칭' : '학교 인증 전엔 항상 다른 학교와 매칭돼요'}</small>
              </span>
              <input type="checkbox" checked={prefs.sameSchoolFilter} onChange={(e) => setPrefs({ ...prefs, sameSchoolFilter: e.target.checked })} />
            </label>
          </Card>

          <Button variant="secondary" onClick={() => navigate('/test')}>
            성향 테스트 다시 하기
          </Button>
          <Button variant="ghost" onClick={onLogout}>
            로그아웃
          </Button>
        </>
      )}

      {tab === 'stats' && <ProfileHistory userId={user.id} />}
    </Layout>
  )
}

export default MyPage
