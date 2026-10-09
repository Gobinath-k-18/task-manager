import Brand from './Brand'

function AuthLayout({ children }) {
  return (
    <main className="app-shell auth-page">
      <section className="auth-panel" aria-label="Account access">
        <div className="auth-card">
          <header className="auth-brand-header">
            <Brand />
            <span>LEARNING STUDIO</span>
          </header>
          {children}
        </div>
      </section>
    </main>
  )
}

export default AuthLayout