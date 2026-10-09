import { NavLink, useLocation } from 'react-router-dom'
import { getUser } from '../api/authStorage'
import Brand from './Brand'

function AppShell({ children, theme, onToggleTheme, onLogout }) {
  const user = getUser()
  const location = useLocation()
  const name = user?.name || 'Your workspace'
  const initials = name.trim().charAt(0) || 'U'

  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <Brand />
          <span className="topbar-divider" aria-hidden="true" />
          <span className="topbar-studio-label">LEARNING STUDIO</span>
          <nav className="workspace-nav" aria-label="Workspace">
            <NavLink to="/dashboard" end className={({ isActive }) => isActive && location.hash !== '#task-workspace' ? 'active' : undefined}>
              Overview
            </NavLink>
            <NavLink to="/dashboard#task-workspace" className={() => location.pathname === '/dashboard' && location.hash === '#task-workspace' ? 'active' : undefined}>
              Tasks
            </NavLink>
            <NavLink to="/roadmaps">
              Roadmaps
            </NavLink>
          </nav>
          <div className="topbar-actions">
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span className="user-chip-copy"><strong>{name}</strong><small>{user?.email || 'Personal workspace'}</small></span>
            </div>
            <button
              className="theme-toggle"
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '◐'}</span>
            </button>
            <button className="topbar-logout" type="button" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  )
}

export default AppShell
