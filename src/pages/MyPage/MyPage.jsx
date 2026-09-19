import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout/Layout'
import { Button, Card, Field, Heading, Input, Notice } from '../../components/ui/ui'
import { updateProfile } from '../../service/authService'
import { getMatchHistory } from '../../service/matchService'
import { useAuth } from '../../store/AuthContext'
import { useMatch } from '../../store/MatchContext'
import { formatDate } from '../../utils'
import styles from './MyPage.module.css'

// 마이페이지: 계정 설정(정보 변경 / 개인 설정) · 통계 · 매칭 기록
function MyPage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()
  const { setMatch } = useMatch()
  const [tab, setTab] = useState('account') // account | stats
  const [form, setForm] = useState({ name: user.name, school: user.school, major: user.major })
  const [prefs, setPrefs] = useState({ autoMatch: false, sameSchoolFilter: false })
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    getMatchHistory(user.id).then(setHistory)
  }, [user.id])

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
            {user.school} · {user.major}
          </div>
          <div className={styles.email}>{user.email}</div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button type="button" className={tab === 'account' ? styles.tabOn : styles.tab} onClick={() => setTab('account')}>
          계정 설정
        </button>
        <button type="button" className={tab === 'stats' ? styles.tabOn : styles.tab} onClick={() => setTab('stats')}>
          통계 · 기록
        </button>
      </div>

      {tab === 'account' && (
        <>
          {saved && <Notice tone="success">저장됐어요</Notice>}
          <h3 className={styles.section}>계정 정보 변경</h3>
          <Field label="이름">
            <Input name="name" value={form.name} onChange={onChange} />
          </Field>
          <div className={styles.row}>
            <Field label="학교">
              <Input name="school" value={form.school} onChange={onChange} />
            </Field>
            <Field label="전공">
              <Input name="major" value={form.major} onChange={onChange} />
            </Field>
          </div>
          <Button variant="secondary" onClick={save}>
            정보 저장
          </Button>

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
                <small>다른 학교 학생만 매칭 (구독 기능)</small>
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

      {tab === 'stats' && (
        <>
          <div className={styles.stats}>
            <Card className={styles.stat}>
              <div className={styles.statNum}>{history.length}</div>
              <div className={styles.statLabel}>총 매칭</div>
            </Card>
            <Card className={styles.stat}>
              <div className={styles.statNum}>{history.reduce((s, h) => s + h.groupSize - 1, 0)}</div>
              <div className={styles.statLabel}>만난 사람</div>
            </Card>
            <Card className={styles.stat}>
              <div className={styles.statNum}>{history.filter((h) => h.date.startsWith('2026-09')).length}</div>
              <div className={styles.statLabel}>이번 달</div>
            </Card>
          </div>

          <h3 className={styles.section}>매칭 기록</h3>
          <div className={styles.history}>
            {history.map((h) => (
              <Card key={h.id} className={styles.historyItem}>
                <div>
                  <div className={styles.historyTitle}>{h.restaurant}</div>
                  <div className={styles.meta}>
                    {formatDate(h.date)} · {h.groupSize}명
                  </div>
                </div>
                <span className={styles.badge}>완료</span>
              </Card>
            ))}
            {history.length === 0 && <p className={styles.empty}>아직 매칭 기록이 없어요</p>}
          </div>
        </>
      )}
    </Layout>
  )
}

export default MyPage
