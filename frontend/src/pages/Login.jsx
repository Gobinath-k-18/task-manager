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
    <AuthLayout
      eyebrow="Your work, in good flow"
      title="Make room for your best work."
      description="Bring your priorities into focus and make steady progress, one task at a time."
    >
      <h2>Welcome back</h2>
      <p className="auth-intro">Sign in to pick up right where you left off.</p>
      {location.state?.registered && (
        <p className="form-alert success" role="status">Your account is ready. Sign in to continue.</p>
      )}
      {error && <p className="form-alert" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email address</label>
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
        <div className="field">
          <label htmlFor="login-password">Password</label>
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