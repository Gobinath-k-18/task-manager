import Brand from './Brand'

function AuthLayout({ children }) {
  return (
    <main className="app-shell auth-page">
      <div className="auth-decoration auth-decoration-left" aria-hidden="true">
        <span className="auth-decoration-label">LEARN AT YOUR PACE</span>
        <svg viewBox="0 0 220 150" fill="none">
          <path d="M5 111c33-27 46-28 70-8s36 14 57-17 39-36 83-39" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 132c34-27 46-28 70-8s36 14 57-17 39-36 83-39" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="75" cy="103" r="4" fill="var(--auth-accent)" />
          <circle cx="132" cy="86" r="4" fill="var(--auth-accent-secondary)" />
          <circle cx="215" cy="47" r="4" fill="var(--auth-accent)" />
        </svg>
      </div>
      <section className="auth-panel" aria-label="Account access">
        <div className="auth-card">
          <header className="auth-brand-header">
            <Brand />
            <span>LEARNING STUDIO</span>
          </header>
          {children}
        </div>
      </section>
      <div className="auth-decoration auth-decoration-right" aria-hidden="true">
        <span className="auth-decoration-label">SMALL STEPS, REAL PROGRESS</span>
        <svg viewBox="0 0 200 120" fill="none">
          <path d="M7 90h44l20-37 29 22 27-43 66 14" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="51" cy="90" r="3.5" fill="var(--auth-accent)" />
          <circle cx="100" cy="75" r="3.5" fill="var(--auth-accent-secondary)" />
          <circle cx="127" cy="32" r="3.5" fill="var(--auth-accent)" />
        </svg>
      </div>
    </main>
  )
}

export default AuthLayout