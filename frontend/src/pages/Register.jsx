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
    <AuthLayout
      eyebrow="A fresh start"
      title="Make your next step a clear one."
      description="Set up your workspace and turn the things you want to do into a plan you can follow."
    >
      <h2>Create your account</h2>
      <p className="auth-intro">It only takes a moment to get started.</p>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="register-name">Full name</label>
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
        <div className="field">
          <label htmlFor="register-email">Email address</label>
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
        <div className="field">
          <label htmlFor="register-password">Password</label>
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