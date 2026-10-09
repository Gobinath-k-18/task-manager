import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import api from '../api/api'
import { getToken } from '../api/authStorage'
import AuthLayout from '../components/AuthLayout'
import { isValidEmail } from '../utils/emailValidation'

function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
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
      await api.post('/auth/register', { name, email, password })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h2>Create your account</h2>
      <p className="auth-intro">It only takes a moment to get started.</p>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="register-name">Full name</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 17c.5-3 2.7-4.5 6.5-4.5s6 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            <input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="register-email">Email address</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="m3.5 5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <input
              id="register-email"
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
          <label htmlFor="register-password">Password</label>
          <div className="auth-input-wrap">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="10" cy="12.5" r="1" fill="currentColor" /></svg>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>
        </div>
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <p className="auth-switch">Already have an account? <Link className="text-link" to="/login">Sign in</Link></p>
    </AuthLayout>
  )
}

export default Register