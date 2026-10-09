import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import api from '../api/api'
import { getToken, saveAuth } from '../api/authStorage'
import AuthLayout from '../components/AuthLayout'
import { isValidEmail } from '../utils/emailValidation'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (getToken()) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!isValidEmail(email)) {
      setError('Please enter a valid Gmail address.')
      return
    }

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }

    setIsSubmitting(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (!data?.token || !data?.user) {
        throw new Error('The server returned an incomplete sign-in response. Please try again.')
      }
      saveAuth(data.token, data.user)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to sign in. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="auth-intro">Sign in to pick up right where you left off.</p>
      {location.state?.registered && (
        <p className="form-alert success" role="status">Your account is ready. Sign in to continue.</p>
      )}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email address</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="m3.5 5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="10" cy="12.5" r="1" fill="currentColor" /></svg>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <p className="auth-switch">New to Taskflow? <Link className="text-link" to="/register">Create an account</Link></p>
    </AuthLayout>
  )
}

export default Login