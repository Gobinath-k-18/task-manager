import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { chatWithRoadmap, completeRoadmapDay, deleteRoadmap, getRoadmaps, uploadRoadmap } from '../api/api'
import { clearAuth } from '../api/authStorage'
import AppShell from '../components/AppShell'
import DeleteTaskDialog from '../components/DeleteTaskDialog'

const MAX_ROADMAP_FILE_SIZE = 10 * 1024 * 1024

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

function RoadmapCard({ roadmap, onDelete }) {
  const progress = getProgress(roadmap)
  const completedDays = getCompletedDays(roadmap)

  return (
    <article className="roadmap-card">
      <div className="roadmap-card-top">
        <span className="roadmap-card-icon" aria-hidden="true">✦</span>
        <div className="roadmap-card-tools">
          <span className={`status-badge ${roadmap.status || 'pending'}`}>
            {getStatusLabel(roadmap.status)}
          </span>
          <button
            className="roadmap-delete-button"
            type="button"
            aria-label={`Delete ${roadmap.title} roadmap`}
            onClick={() => onDelete(roadmap)}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4.5 6h11M8 6V4h4v2m2.5 0-.6 10H6.1L5.5 6m3 3v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <Link className="roadmap-card-content" to={`/roadmaps/${roadmap.id}`}>
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
    </article>
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

function RoadmapChat({ roadmap }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I’m your AI Learning Assistant. Ask me anything about today’s learning task.',
    },
  ])
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(event) {
    event?.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isSending) return

    setIsSending(true)
    setError('')
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedMessage,
    }
    setMessages((currentMessages) => [...currentMessages, userMessage])

    try {
      const { data } = await chatWithRoadmap(roadmap.id, trimmedMessage)
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error('Empty assistant response')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
        },
      ])
      setMessage('')
    } catch {
      setError('Sorry, I couldn’t get an answer right now. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend(event)
    }
  }

  return (
    <section className="roadmap-chat" aria-labelledby="roadmap-chat-title">
      <div className="roadmap-chat-heading">
        <span className="roadmap-chat-icon" aria-hidden="true">✦</span>
        <div>
          <h2 id="roadmap-chat-title">AI Learning Assistant</h2>
          <p>Ask questions about your current roadmap and learning task.</p>
        </div>
      </div>

      <div className="roadmap-chat-messages" aria-live="polite" aria-label="Chat messages">
        {messages.map((chatMessage) => (
          <div
            className={`roadmap-chat-message ${chatMessage.role}`}
            key={chatMessage.id}
          >
            <span className="roadmap-chat-message-label">
              {chatMessage.role === 'user' ? 'You' : 'Assistant'}
            </span>
            <p>{chatMessage.content}</p>
          </div>
        ))}
        {isSending && (
          <div className="roadmap-chat-message assistant" role="status">
            <span className="roadmap-chat-message-label">Assistant</span>
            <p>Thinking...</p>
          </div>
        )}
      </div>

      {error && (
        <p className="roadmap-chat-error" role="alert">
          {error}
          <button type="button" onClick={() => handleSend()}>Try again</button>
        </p>
      )}

      <form className="roadmap-chat-form" onSubmit={handleSend}>
        <label className="visually-hidden" htmlFor="roadmap-chat-input">
          Ask the AI Learning Assistant
        </label>
        <textarea
          id="roadmap-chat-input"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about today's learning task..."
          rows={2}
          maxLength={2000}
          disabled={isSending}
        />
        <button
          className="create-task-submit roadmap-chat-send"
          type="submit"
          disabled={isSending || !message.trim()}
        >
          {isSending ? 'Thinking...' : 'Send'}
        </button>
      </form>
      <p className="roadmap-chat-hint">Press Enter to send · Shift+Enter for a new line</p>
    </section>
  )
}

function Roadmaps({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const { roadmapId } = useParams()
  const fileInputRef = useRef(null)
  const [roadmaps, setRoadmaps] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [completingDay, setCompletingDay] = useState(null)
  const [completionMessage, setCompletionMessage] = useState('')
  const [completionError, setCompletionError] = useState('')
  const [roadmapToDelete, setRoadmapToDelete] = useState(null)
  const [roadmapSuccessMessage, setRoadmapSuccessMessage] = useState('')
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

  async function uploadSelectedRoadmap(file) {
    setUploadError('')
    setUploadSuccess('')

    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setUploadError('Please choose a PDF file.')
      return
    }

    if (file.size > MAX_ROADMAP_FILE_SIZE) {
      setUploadError('This PDF is larger than 10 MB. Choose a smaller file.')
      return
    }

    const formData = new FormData()
    formData.append('document', file)
    setIsUploading(true)
    setUploadProgress(null)

    try {
      await uploadRoadmap(formData, {
        onUploadProgress: ({ loaded, total }) => {
          if (total) setUploadProgress(Math.round((loaded / total) * 100))
        },
      })
      setUploadSuccess('Roadmap uploaded successfully. Your list has been refreshed.')
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        return
      }

      const responseMessage = requestError.response?.data?.message
      setUploadError(
        requestError.response?.status === 413
          ? 'This PDF is larger than the upload limit. Choose a smaller file.'
          : typeof responseMessage === 'string' && responseMessage.trim()
            ? responseMessage
            : 'We couldn’t upload this PDF. Please check your connection and try again.',
      )
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  async function handleRoadmapFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSelectedFile(file)
    await uploadSelectedRoadmap(file)
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

  async function handleDeleteRoadmap() {
    if (!roadmapToDelete) return

    try {
      await deleteRoadmap(roadmapToDelete.id)
      setRoadmaps((currentRoadmaps) => currentRoadmaps.filter(
        (roadmap) => roadmap.id !== roadmapToDelete.id,
      ))
      setRoadmapSuccessMessage(`“${roadmapToDelete.title}” was deleted successfully.`)
      const deletedRoadmapId = String(roadmapToDelete.id)
      setRoadmapToDelete(null)
      if (roadmapId === deletedRoadmapId) {
        navigate('/roadmaps', { replace: true })
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      throw new Error(
        requestError.response?.data?.message
          || 'We couldn’t delete this roadmap. Please try again.',
      )
    }
  }

  const totalDays = Number(selectedRoadmap?.total_days) || selectedRoadmap?.days?.length || 0
  const progress = selectedRoadmap ? getProgress(selectedRoadmap) : 0
  const completedDays = selectedRoadmap ? getCompletedDays(selectedRoadmap) : 0

  return (
    <AppShell theme={theme} onToggleTheme={onToggleTheme} onLogout={handleLogout}>
      <div className="dashboard-page">
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
              <div className="roadmap-detail-actions">
                <span className={`status-badge ${selectedRoadmap.status || 'pending'}`}>
                  {getStatusLabel(selectedRoadmap.status)}
                </span>
                <button
                  className="roadmap-delete-button"
                  type="button"
                  aria-label={`Delete ${selectedRoadmap.title} roadmap`}
                  onClick={() => setRoadmapToDelete(selectedRoadmap)}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 6h11M8 6V4h4v2m2.5 0-.6 10H6.1L5.5 6m3 3v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete
                </button>
              </div>
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
                <p>Complete today’s lesson to unlock the next step. Your progress is saved as you go.</p>
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
            <RoadmapChat key={selectedRoadmap.id} roadmap={selectedRoadmap} />
          </>
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow"><span className="eyebrow-dot" /> YOUR LEARNING LIBRARY</p>
                <h1 id="roadmaps-title">Learn with a plan.</h1>
                <p>Turn what you want to know into a clear, day-by-day journey.</p>
              </div>
              <div className="summary-card" aria-label={`${roadmaps.length} learning roadmaps`}>
                <span className="summary-icon" aria-hidden="true">✦</span>
                <span>
                  <strong className="summary-number">{roadmaps.length}</strong>
                  <span className="summary-label">Learning plans</span>
                </span>
              </div>
            </div>

            <div className="roadmap-upload-panel">
              <span className="roadmap-upload-icon" aria-hidden="true">↥</span>
              <div className="roadmap-upload-copy">
                <strong>Add a learning roadmap</strong>
                <span>Upload a PDF and we’ll map out your next steps.</span>
              </div>
              <input
                ref={fileInputRef}
                className="roadmap-upload-input"
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Choose a PDF roadmap"
                onChange={handleRoadmapFileChange}
              />
              <button
                className="create-task-button roadmap-upload-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading…' : 'Choose a PDF'}
              </button>
              <span className="roadmap-upload-filename" id="roadmap-upload-help">
                {selectedFile?.name || 'Choose a PDF file up to 10 MB.'}
              </span>
              {uploadError && selectedFile && !isUploading && (
                <button
                  className="roadmap-retry-button"
                  type="button"
                  onClick={() => uploadSelectedRoadmap(selectedFile)}
                >
                  Retry upload
                </button>
              )}
              {isUploading && (
                <div className="upload-progress roadmap-upload-progress" role="status">
                  {uploadProgress === null ? (
                    <span>Uploading {selectedFile?.name}…</span>
                  ) : uploadProgress < 100 ? (
                    <>
                      <span>Uploading PDF · {uploadProgress}%</span>
                      <progress
                        max="100"
                        value={uploadProgress}
                        aria-label="Roadmap PDF upload progress"
                      />
                    </>
                  ) : (
                    <span>PDF uploaded. Generating your roadmap…</span>
                  )}
                </div>
              )}
              {uploadError && (
                <p className="form-alert roadmap-upload-error" role="alert">{uploadError}</p>
              )}
              {uploadSuccess && (
                <p className="task-success-message success roadmap-upload-success" role="status">
                  <span aria-hidden="true">✓</span>{uploadSuccess}
                </p>
              )}
            </div>

            {roadmapSuccessMessage && (
              <p className="task-success-message roadmap-delete-success" role="status">
                <span aria-hidden="true">✓</span>{roadmapSuccessMessage}
                <button type="button" onClick={() => setRoadmapSuccessMessage('')} aria-label="Dismiss deletion message">×</button>
              </p>
            )}

            {roadmaps.length === 0 ? (
              <div className="task-state">
                <div className="task-state-inner">
                  <span className="state-icon" aria-hidden="true">✦</span>
                  <span className="state-icon" aria-hidden="true">⌁</span>
                  <h2>Your first learning journey starts here</h2>
                  <p>Upload a PDF roadmap to turn your goal into focused daily lessons. Your saved plans will live here.</p>
                  <button className="secondary-button roadmap-state-link" type="button" onClick={() => fileInputRef.current?.click()}>
                    Choose your first PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="roadmap-grid">
                {roadmaps.map((roadmap) => (
                  <RoadmapCard key={roadmap.id} roadmap={roadmap} onDelete={setRoadmapToDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
      </div>
      {roadmapToDelete && (
        <DeleteTaskDialog
          task={roadmapToDelete}
          entityLabel="roadmap"
          confirmationMessage="Delete this roadmap? Its learning progress and roadmap history will be permanently removed."
          onCancel={() => setRoadmapToDelete(null)}
          onConfirm={handleDeleteRoadmap}
        />
      )}
    </AppShell>
  )
}

export default Roadmaps
