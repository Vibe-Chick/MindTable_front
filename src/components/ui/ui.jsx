import styles from './ui.module.css'

export function Button({ variant = 'primary', full = true, className = '', ...props }) {
  const cls = [styles.btn, styles[variant], full ? styles.full : '', className].join(' ')
  return <button type="button" className={cls} {...props} />
}

export function Field({ label, error, hint, children }) {
  return (
    <label className={styles.field}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </label>
  )
}

export function Input({ className = '', invalid, ...props }) {
  return <input className={[styles.input, invalid ? styles.invalid : '', className].join(' ')} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={[styles.input, styles.textarea, className].join(' ')} {...props} />
}

export function Notice({ tone = 'info', children }) {
  return <div className={[styles.notice, styles[`notice_${tone}`]].join(' ')}>{children}</div>
}

export function Heading({ children, sub }) {
  return (
    <div className={styles.headingWrap}>
      <h1 className={styles.heading}>{children}</h1>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  )
}

export function Card({ className = '', ...props }) {
  return <div className={[styles.card, className].join(' ')} {...props} />
}
