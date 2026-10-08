import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { completeRoadmapDay, getRoadmaps } from '../api/api'
import { clearAuth, getUser } from '../api/authStorage'
import Brand from '../components/Brand'

function getCompletedDays(roadmap) {
  if (roadmap.status === 'completed') return roadmap.total_days || roadmap.days?.length || 0
  return Array.isArray(roadmap.days)
    ? roadmap.days.filter((day) => day.status === 'completed').length
    : 0
}

function getProgress(roadmap) {
  const totalDays = Number(roadmap.total_days) || roadmap.days?.length || 0
  if (totalDays === 0) return 0
  return Math.min(100, Math.round((getCompletedDays(roadmap) / totalDays) * 100))
}

function getStatusLabel(status) {
  if (status === 'in_progress') return 'In progress'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  return 'Pending'
}

function RoadmapCard({ roadmap }) {
  const progress = getProgress(roadmap)
  const completedDays = getCompletedDays(roadmap)

  return (
    <Link className="roadmap-card" to={`/roadmaps/${roadmap.id}`}>
      <div className="roadmap-card-top">
        <span className="roadmap-card-icon" aria-hidden="true">✦</span>
        <span className={`status-badge ${roadmap.status || 'pending'}`}>
          {getStatusLabel(roadmap.status)}
        </span>
      </div>
      <h2>{roadmap.title}</h2>
      <p className="roadmap-card-description">
        {roadmap.description || 'A learning plan tailored to your goals.'}
      </p>
      <div className="roadmap-progress-meta">
        <span>{completedDays} of {roadmap.total_days || roadmap.days?.length || 0} days</span>
        <span>{progress}%</span>
      </div>
      <div
        className="roadmap-progress-track"
        role="progressbar"
        aria-label={`${roadmap.title} progress`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="roadmap-card-current">
        {roadmap.status === 'completed'
          ? 'Roadmap complete'
          : `Current day: ${roadmap.current_day || 1}`}
      </p>
      <span className="roadmap-card-link">View learning plan <span aria-hidden="true">→</span></span>
    </Link>
  )
}

function RoadmapDay({ day, currentDay, roadmapStatus, onComplete, isCompleting }) {
  const isCompleted = day.status === 'completed'
  const isCurrent = !isCompleted
    && roadmapStatus !== 'completed'
    && day.day_number === currentDay
  const isUpcoming = !isCompleted
    && !isCurrent
    && day.status === 'pending'
    && day.day_number > currentDay
  const state = isCompleted ? 'completed' : isCurrent ? 'current' : isUpcoming ? 'upcoming' : ''
  const topics = Array.isArray(day.topics)
    ? day.topics
    : typeof day.topics === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(day.topics)
          return Array.isArray(parsed) ? parsed : [day.topics]
        } catch {
          return day.topics.split(/\r?\n|,/).map((topic) => topic.trim()).filter(Boolean)
        }
      })()
      : []

  return (
    <article className={`roadmap-day-card ${state}`}>
      <div className="roadmap-day-marker" aria-hidden="true">
        {isCompleted ? '✓' : day.day_number}
      </div>
      <div className="roadmap-day-content">
        <div className="roadmap-day-heading">
          <div>
            <p className="roadmap-day-label">Day {day.day_number}{isCurrent ? ' · Up next' : ''}</p>
            <h3>{day.title}</h3>
          </div>
          <span className={`status-badge ${day.status || 'pending'}`}>
            {getStatusLabel(day.status)}
          </span>
        </div>
        <p className="roadmap-day-description">{day.description}</p>
        {topics.length > 0 && (
          <ul className="roadmap-topics" aria-label={`Topics for day ${day.day_number}`}>
            {topics.map((topic, index) => (
              <li key={`${topic}-${index}`}>{topic}</li>
            ))}
          </ul>
        )}
        {isCurrent && (
          <button
            className="create-task-submit roadmap-complete-button"
            type="button"
            onClick={() => onComplete(day.day_number)}
            disabled={isCompleting}
          >
            {isCompleting ? 'Saving progress…' : 'Mark Day as Completed'}
          </button>
        )}
      </div>
    </article>
  )
}

function Roadmaps({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const { roadmapId } = useParams()
  const user = getUser()
  const [roadmaps, setRoadmaps] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [completingDay, setCompletingDay] = useState(null)
  const [completionMessage, setCompletionMessage] = useState('')
  const [completionError, setCompletionError] = useState('')
  const selectedRoadmap = roadmaps.find((roadmap) => String(roadmap.id) === roadmapId)

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    getRoadmaps({ signal: controller.signal })
      .then(({ data }) => {
        const roadmapList = Array.isArray(data)
          ? data
          : Array.isArray(data?.roadmaps)
            ? data.roadmaps
            : null

        if (!roadmapList) {
          throw new Error('The roadmap response was not in the expected format.')
        }

        if (isMounted) setRoadmaps(roadmapList)
      })
      .catch((requestError) => {
        if (!isMounted || requestError.code === 'ERR_CANCELED') return
        if (requestError.response?.status === 401) {
          clearAuth()
          navigate('/login', { replace: true })
          return
        }
        setError(
          requestError.response?.data?.message
            || requestError.message
            || 'We couldn’t load your roadmaps. Please try again.',
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [navigate, reloadKey])

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  function handleRetry() {
    setError('')
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function handleCompleteDay(dayNumber) {
    if (!selectedRoadmap || completingDay !== null) return

    setCompletingDay(dayNumber)
    setCompletionMessage('')
    setCompletionError('')

    try {
      const { data } = await completeRoadmapDay(selectedRoadmap.id, dayNumber)
      const updatedRoadmap = data.roadmap
      const completedDay = data.completed_day

      setRoadmaps((currentRoadmaps) => currentRoadmaps.map((roadmap) => {
        if (roadmap.id !== updatedRoadmap.id) return roadmap

        return {
          ...roadmap,
          ...updatedRoadmap,
          days: roadmap.days.map((day) => {
            if (day.day_number === completedDay.day_number) {
              return { ...day, status: 'completed', completed_at: completedDay.completed_at }
            }
            if (
              data.next_day
              && day.day_number === data.next_day.day_number
            ) {
              return { ...day, status: 'in_progress' }
            }
            return day
          }),
        }
      }))
      setCompletionMessage(data.message || `Day ${dayNumber} completed successfully.`)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      setCompletionError(
        requestError.response?.data?.message
          || 'We couldn’t update your roadmap progress. Please try again.',
      )
    } finally {
      setCompletingDay(null)
    }
  }

  const initials = user?.name?.trim().charAt(0) || 'U'
  const totalDays = Number(selectedRoadmap?.total_days) || selectedRoadmap?.days?.length || 0
  const progress = selectedRoadmap ? getProgress(selectedRoadmap) : 0
  const completedDays = selectedRoadmap ? getCompletedDays(selectedRoadmap) : 0

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <Brand />
        <nav className="workspace-nav" aria-label="Workspace">
          <NavLink to="/dashboard">Tasks</NavLink>
          <NavLink to="/roadmaps">Roadmaps</NavLink>
        </nav>
        <div className="topbar-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span>{user?.name || 'Your workspace'}</span>
          </div>
          <button className="secondary-button" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <section className="dashboard-content roadmap-content" aria-labelledby="roadmaps-title">
        {roadmapId && (
          <Link className="roadmap-back-link" to="/roadmaps">
            <span aria-hidden="true">←</span> All roadmaps
          </Link>
        )}

        {isLoading ? (
          <div className="task-state" role="status" aria-label="Loading roadmaps">
            <span className="loading-indicator" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="task-state" role="alert">
            <div className="task-state-inner">
              <span className="state-icon" aria-hidden="true">!</span>
              <h2>Roadmaps didn’t load</h2>
              <p>{error}</p>
              <button className="secondary-button" type="button" onClick={handleRetry}>
                Try again
              </button>
            </div>
          </div>
        ) : roadmapId && !selectedRoadmap ? (
          <div className="task-state">
            <div className="task-state-inner">
              <span className="state-icon" aria-hidden="true">⌕</span>
              <h2>Roadmap not found</h2>
              <p>This roadmap may have been removed or may not be available to your account.</p>
              <Link className="secondary-button roadmap-state-link" to="/roadmaps">Back to roadmaps</Link>
            </div>
          </div>
        ) : selectedRoadmap ? (
          <>
            <div className="roadmap-detail-heading">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> YOUR LEARNING PLAN</p>
                <h1 id="roadmaps-title">{selectedRoadmap.title}</h1>
                <p>{selectedRoadmap.description}</p>
              </div>
              <span className={`status-badge ${selectedRoadmap.status || 'pending'}`}>
                {getStatusLabel(selectedRoadmap.status)}
              </span>
            </div>

            {completionMessage && (
              <p className="task-success-message roadmap-completion-message" role="status">
                <span aria-hidden="true">✓</span> {completionMessage}
                <button
                  type="button"
                  onClick={() => setCompletionMessage('')}
                  aria-label="Dismiss progress message"
                >
                  ×
                </button>
              </p>
            )}
            {completionError && (
              <p className="form-alert roadmap-completion-error" role="alert">
                {completionError}
              </p>
            )}

            <section className="roadmap-overview" aria-label="Roadmap progress">
              <div className="roadmap-overview-item">
                <span className="roadmap-overview-value">{totalDays}</span>
                <span className="roadmap-overview-label">Total days</span>
              </div>
              <div className="roadmap-overview-item">
                <span className="roadmap-overview-value">
                  {selectedRoadmap.status === 'completed' ? 'Done' : selectedRoadmap.current_day || 1}
                </span>
                <span className="roadmap-overview-label">Current day</span>
              </div>
              <div className="roadmap-overview-progress">
                <div className="roadmap-progress-meta">
                  <span>Overall progress</span>
                  <span>{completedDays} of {totalDays} days · {progress}%</span>
                </div>
                <div
                  className="roadmap-progress-track"
                  role="progressbar"
                  aria-label="Roadmap progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={progress}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            </section>

            <div className="roadmap-days-header">
              <div>
                <h2>Day-by-day plan</h2>
                <p>Take it one step at a time. Your progress is saved as you go.</p>
              </div>
              <span className="task-count">{selectedRoadmap.days?.length || 0} days</span>
            </div>

            {Array.isArray(selectedRoadmap.days) && selectedRoadmap.days.length > 0 ? (
              <div className="roadmap-day-list">
                {[...selectedRoadmap.days]
                  .sort((firstDay, secondDay) => firstDay.day_number - secondDay.day_number)
                  .map((day) => (
                    <RoadmapDay
                      key={day.id || day.day_number}
                      day={day}
                      currentDay={selectedRoadmap.current_day || 1}
                      roadmapStatus={selectedRoadmap.status}
                      onComplete={handleCompleteDay}
                      isCompleting={completingDay === day.day_number}
                    />
                  ))}
              </div>
            ) : (
              <div className="task-state">
                <div className="task-state-inner">
                  <h2>No daily plans available</h2>
                  <p>This roadmap does not have any day-by-day learning plans yet.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> KEEP GROWING</p>
                <h1 id="roadmaps-title">Your roadmaps</h1>
                <p>Learning plans to help you reach your next goal.</p>
              </div>
              <div className="summary-card" aria-label={`${roadmaps.length} learning roadmaps`}>
                <span className="summary-icon" aria-hidden="true">✦</span>
                <span>
                  <strong className="summary-number">{roadmaps.length}</strong>
                  <span className="summary-label">Learning plans</span>
                </span>
              </div>
            </div>

            {roadmaps.length === 0 ? (
              <div className="task-state">
                <div className="task-state-inner">
                  <span className="state-icon" aria-hidden="true">✦</span>
                  <h2>Your learning journey starts here</h2>
                  <p>You don’t have any roadmaps yet. Once a roadmap is created, it will appear here.</p>
                  <Link className="secondary-button roadmap-state-link" to="/dashboard">
                    Back to tasks
                  </Link>
                </div>
              </div>
            ) : (
              <div className="roadmap-grid">
                {roadmaps.map((roadmap) => (
                  <RoadmapCard key={roadmap.id} roadmap={roadmap} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default Roadmaps
