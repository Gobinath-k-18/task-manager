import Brand from './Brand'

function AuthLayout({ eyebrow, title, description, children }) {
  return (
    <main className="app-shell auth-page">
      <aside className="auth-showcase" aria-label="Taskflow introduction">
        <Brand />
        <div className="showcase-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <footer className="showcase-footer">A little more focus. A lot more progress.</footer>
      </aside>
      <section className="auth-panel">
        <div className="auth-card">
          <Brand className="mobile-brand" />
          {children}
        </div>
      </section>
    </main>
  )
}

export default AuthLayout