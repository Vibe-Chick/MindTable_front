import { useState } from 'react'
import { Button, Card, Notice } from '../ui/ui'
import {
  PUSH_TYPES,
  disablePush,
  enablePush,
  getPermission,
  getPrefs,
  getSubscriptionInfo,
  isPushSupported,
  notifyLocal,
  savePrefs,
} from '../../service/pushService'
import styles from './PushSettings.module.css'

// 마이페이지 "알림 설정" 섹션: 푸시 켜기/끄기 + 종류별 on/off + iOS 홈 화면 추가 안내
function PushSettings() {
  const [prefs, setPrefs] = useState(getPrefs)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [iosGuide, setIosGuide] = useState(false)
  const [tested, setTested] = useState(false)

  const supported = isPushSupported()
  const blocked = getPermission() === 'denied'
  const sub = getSubscriptionInfo()

  const toggleMaster = async () => {
    setError('')
    setBusy(true)
    try {
      setPrefs(prefs.enabled ? await disablePush() : await enablePush())
    } catch (err) {
      if (err.message === 'IOS_INSTALL_REQUIRED') setIosGuide(true)
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleType = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await savePrefs(next)
  }

  const sendTest = async () => {
    const ok = await notifyLocal({ type: 'match_done', title: '✨ 테스트 알림', body: '이렇게 도착해요. 앱을 닫아도 와요', url: '/home' })
    setTested(ok)
    if (!ok) setError('알림을 띄우지 못했어요. 권한과 설정을 확인해줘')
  }

  return (
    <>
      <h3 className={styles.section}>알림 설정</h3>
      {error && <Notice tone="error">{error}</Notice>}
      {blocked && !error && <Notice tone="error">브라우저에서 알림이 차단돼 있어요. 주소창 자물쇠 → 사이트 설정에서 허용으로 바꿔줘</Notice>}

      <Card className={styles.card}>
        <label className={styles.pref}>
          <span>
            <strong>푸시 알림 받기</strong>
            <small>
              {!supported
                ? '이 브라우저는 푸시를 지원하지 않아요'
                : prefs.enabled && sub
                  ? `이 기기(${sub.device})로 받는 중`
                  : '앱을 닫아도 매칭 · 장소 확정 · 테이블 리뷰 요청을 알려줘요'}
            </small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.enabled}
            aria-label="푸시 알림 받기"
            className={prefs.enabled ? styles.toggleOn : styles.toggle}
            onClick={toggleMaster}
            disabled={busy || !supported || blocked}
          />
        </label>

        {PUSH_TYPES.map((t) => (
          <label key={t.key} className={prefs.enabled ? styles.pref : styles.prefDim}>
            <span>
              <strong>{t.label}</strong>
              <small>{t.desc}</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[t.key]}
              aria-label={t.label}
              className={prefs[t.key] ? styles.toggleOn : styles.toggle}
              onClick={() => toggleType(t.key)}
              disabled={!prefs.enabled}
            />
          </label>
        ))}

        {prefs.enabled && (
          <Button variant="ghost" onClick={sendTest}>
            {tested ? '테스트 알림을 보냈어요 ✓' : '테스트 알림 보내기'}
          </Button>
        )}
      </Card>

      {iosGuide && <IOSInstallGuide onClose={() => setIosGuide(false)} />}
    </>
  )
}

// iOS Safari 는 홈 화면에 추가한 앱에서만 푸시가 동작
function IOSInstallGuide({ onClose }) {
  return (
    <div className={styles.dim} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h4>iPhone에서 푸시를 받으려면</h4>
        <p>Safari에서는 홈 화면에 추가한 앱만 알림을 받을 수 있어요. 30초면 끝나요.</p>
        <div className={styles.step}>
          <span className={styles.n}>1</span>Safari 하단 <b>공유</b> 버튼 탭
        </div>
        <div className={styles.step}>
          <span className={styles.n}>2</span>
          <b>홈 화면에 추가</b> 선택
        </div>
        <div className={styles.step}>
          <span className={styles.n}>3</span>홈 화면의 MindTable 아이콘으로 열고 다시 켜기
        </div>
        <Button onClick={onClose}>알겠어요</Button>
      </div>
    </div>
  )
}

export default PushSettings
