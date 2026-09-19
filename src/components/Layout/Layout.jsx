import { useNavigate } from 'react-router-dom'
import styles from './Layout.module.css'

// 모바일 앱 느낌의 공통 프레임. title/back/progress를 옵션으로 받는다.
function Layout({ children, title, showBack = false, step, totalSteps = 4, right }) {
  const navigate = useNavigate()

  return (
    <div className={styles.frame}>
      <header className={styles.nav}>
        <div className={styles.navSide}>
          {showBack && (
            <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="뒤로">
              ‹
            </button>
          )}
        </div>
        <div className={styles.navCenter}>
          {step ? (
            <div className={styles.progress}>
              <div className={styles.bar}>
                {Array.from({ length: totalSteps }, (_, i) => (
                  <span key={i} className={i < step ? styles.dotOn : styles.dot} />
                ))}
              </div>
              <span className={styles.stepLabel}>
                {step} / {totalSteps}
              </span>
            </div>
          ) : (
            title && <span className={styles.title}>{title}</span>
          )}
        </div>
        <div className={styles.navSide}>{right}</div>
      </header>
      <main className={styles.body}>{children}</main>
    </div>
  )
}

export default Layout
