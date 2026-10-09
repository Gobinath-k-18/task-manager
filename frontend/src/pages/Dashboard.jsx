import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { getRoadmaps } from '../api/api'
import { clearAuth } from '../api/authStorage'
import AppShell from '../components/AppShell'
import CreateTaskModal from '../components/CreateTaskModal'
import DeleteTaskDialog from '../components/DeleteTaskDialog'
import TaskCard from '../components/TaskCard'

const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date())

function Dashboard({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [roadmaps, setRoadmaps] = useState([])
  const [roadmapsLoading, setRoadmapsLoading] = useState(true)
  const [roadmapsError, setRoadmapsError] = useState('')
  const [roadmapsReloadKey, setRoadmapsReloadKey] = useState(0)

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await api.get('/tasks')
      setTasks(Array.isArray(data) ? data : [])
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      setError(requestError.response?.data?.message || 'We couldn’t load your tasks. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  function handleRetry() {
    loadTasks()
  }

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    api.get('/tasks', { signal: controller.signal })
      .then(({ data }) => {
        if (isMounted) setTasks(Array.isArray(data) ? data : [])
      })
      .catch((requestError) => {
        if (!isMounted || requestError.code === 'ERR_CANCELED') return
        if (requestError.response?.status === 401) {
          clearAuth()
          navigate('/login', { replace: true })
          return
        }
        setError(requestError.response?.data?.message || 'We couldn’t load your tasks. Please try again.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    getRoadmaps({ signal: controller.signal })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.roadmaps
        if (!Array.isArray(list)) throw new Error('The roadmap response was not in the expected format.')
        if (isMounted) setRoadmaps(list)
      })
      .catch((requestError) => {
        if (!isMounted || requestError.code === 'ERR_CANCELED') return
        if (requestError.response?.status === 401) {
          clearAuth()
          navigate('/login', { replace: true })
          return
        }
        setRoadmapsError(requestError.response?.data?.message || 'We couldn’t load your learning paths.')
      })
      .finally(() => {
        if (isMounted) setRoadmapsLoading(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [navigate, roadmapsReloadKey])

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === 'completed').length,
    [tasks],
  )
  const inProgressCount = useMemo(
    () => tasks.filter((task) => task.status === 'in_progress').length,
    [tasks],
  )
  const pendingCount = useMemo(
    () => tasks.filter((task) => task.status === 'pending').length,
    [tasks],
  )
  const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0
  const todayFocus = tasks.find((task) => task.status === 'in_progress')
    || tasks.find((task) => task.status === 'pending')
  const assistantRoadmap = roadmaps.find((roadmap) => roadmap.status !== 'completed') || roadmaps[0]
  const filteredTasks = useMemo(
    () => {
      const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
      return tasks.filter((task) => {
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter
        const matchesSearch = !normalizedQuery
          || `${task.title || ''} ${task.description || ''}`.toLocaleLowerCase().includes(normalizedQuery)
        return matchesStatus && matchesSearch
      })
    },
    [searchQuery, statusFilter, tasks],
  )

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  async function handleTaskSaved(action) {
    setIsCreateOpen(false)
    setEditingTask(null)
    setSuccessMessage(action === 'updated' ? 'Task updated successfully.' : 'Task created successfully.')
    await loadTasks()
  }

  async function handleDeleteTask() {
    try {
      await api.delete(`/tasks/${taskToDelete.id}`)
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        setTaskToDelete(null)
        return
      }
      throw new Error('We couldn’t delete this task. Please try again.')
    }

    setTaskToDelete(null)
    setSuccessMessage('Task deleted successfully.')
    await loadTasks()
  }

  function openCreateTask() {
    setSuccessMessage('')
    setEditingTask(null)
    setIsCreateOpen(true)
  }

  function openEditTask(task) {
    setSuccessMessage('')
    setEditingTask(task)
    setIsCreateOpen(true)
  }

  return (
    <AppShell theme={theme} onToggleTheme={onToggleTheme} onLogout={handleLogout}>
      <div className="dashboard-page">
      <section className="dashboard-content" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR OVERVIEW</p>
            <h1 id="dashboard-title">A clearer view of your day.</h1>
            <p>Make space for what matters, and keep your learning moving.</p>
          </div>
          <svg className="header-landscape" viewBox="0 0 260 104" fill="none" aria-hidden="true">
            <path d="M2 83c31-23 50-35 80-29 25 5 34 18 56 8 25-12 37-40 69-37 18 2 33 13 51 9" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 94c34-15 53-20 82-15 28 5 39 12 62 1 29-14 44-24 70-19 18 3 29 9 42 7" stroke="currentColor" strokeWidth="1.2" />
            <path d="M37 81c7-13 16-18 27-19m121-24c4-13 12-20 23-23m-10 25c5-10 13-15 22-16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="63" cy="61" r="3" fill="var(--coral)" /><circle cx="207" cy="31" r="3" fill="var(--mint)" />
          </svg>
        </div>

        <div className="overview-focus-grid">
          <section className="today-focus-card" aria-labelledby="today-focus-heading">
            <div className="focus-card-heading">
              <span className="focus-sun-mark" aria-hidden="true">✳</span>
              <div><p className="section-kicker">A GOOD PLACE TO START</p><h2 id="today-focus-heading">Today’s focus</h2></div>
              <span className="focus-date-label">{todayLabel}</span>
            </div>
            {isLoading ? (
              <div className="focus-loading" role="status">Finding your next task…</div>
            ) : todayFocus ? (
              <>
                <p className="focus-task-title">{todayFocus.title}</p>
                <p className="focus-task-description">{todayFocus.description || 'A good time to take this one step forward.'}</p>
                <div className="focus-task-footer">
                  <span className={`status-badge ${todayFocus.status}`}>{todayFocus.status === 'in_progress' ? 'In progress' : 'Up next'}</span>
                  {todayFocus.due_date && <span className="focus-due-date">Due {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${String(todayFocus.due_date).slice(0, 10)}T00:00:00`))}</span>}
                  <Link to="/dashboard#task-workspace" className="focus-link">Open task board <span aria-hidden="true">→</span></Link>
                </div>
              </>
            ) : (
              <div className="focus-empty"><strong>You’re all caught up.</strong><span>Add a task when you’re ready to choose your next focus.</span><button className="text-button" type="button" onClick={openCreateTask}>Create a task <span aria-hidden="true">→</span></button></div>
            )}
          </section>
          <section className="progress-summary-card" aria-label="Task progress summary">
            <div className="progress-summary-top"><div><p className="section-kicker">YOUR MOMENTUM</p><h2>Task progress</h2></div><span className="progress-ring" style={{ '--progress': `${progressPercent}%` }} aria-label={`${progressPercent}% complete`}><span>{progressPercent}%</span></span></div>
            <div className="summary-progress-copy"><strong>{completedCount} <span>of {tasks.length}</span></strong><small>tasks completed</small></div>
            <div className="roadmap-progress-track" role="progressbar" aria-label="Task completion progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressPercent}><span style={{ width: `${progressPercent}%` }} /></div>
            <div className="compact-task-summary"><span>{inProgressCount} in progress</span><span>{pendingCount} up next</span></div>
          </section>
        </div>

        <div className="task-section-heading" id="task-workspace">
          <div><p className="section-kicker">YOUR PRIORITIES</p><h2 id="tasks-heading">Task workspace</h2></div>
          <div className="task-section-actions">
            <button className="create-task-button" type="button" onClick={openCreateTask}>
              <span aria-hidden="true">+</span> Create Task
            </button>
          </div>
        </div>

        <div className="task-filter-row">
          <div className="task-search-control">
            <label htmlFor="task-search">Search tasks</label>
            <div className="task-search-input-wrap">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.6" />
                <path d="m13.2 13.2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                id="task-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title or description"
                aria-label="Search tasks by title or description"
              />
            </div>
          </div>
          <div className="task-filter-control">
            <label htmlFor="task-status-filter">Status</label>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <span className="task-count" aria-live="polite">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {successMessage && (
          <p className="task-success-message" role="status">
            <span aria-hidden="true">✓</span> {successMessage}
            <button type="button" onClick={() => setSuccessMessage('')} aria-label="Dismiss success message">×</button>
          </p>
        )}

        {isLoading ? (
          <div className="task-state" role="status" aria-label="Loading tasks">
            <span className="loading-indicator" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="task-state" role="alert">
            <div className="task-state-inner">
              <span className="state-icon" aria-hidden="true">!</span>
              <h2>Tasks didn’t load</h2>
              <p>{error}</p>
              <button className="secondary-button" type="button" onClick={handleRetry}>Try again</button>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="task-state">
            <div className="task-state-inner">
              <span className="state-icon" aria-hidden="true">✦</span>
              <h2>Your task list is clear</h2>
              <p>When you have tasks, they’ll show up here. Enjoy the breathing room.</p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="task-state">
            <div className="task-state-inner">
              <span className="state-icon" aria-hidden="true">⌕</span>
              <h2>No tasks found</h2>
              <p>Try a different search or status filter.</p>
              <button
                className="secondary-button show-all-tasks-button"
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('all')
                }}
              >
                Clear search and filters
              </button>
            </div>
          </div>
        ) : (
          <div className="task-grid" aria-labelledby="tasks-heading">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => openEditTask(task)}
                onDelete={() => setTaskToDelete(task)}
              />
            ))}
          </div>
        )}

        <section className="learning-paths-section" aria-labelledby="learning-paths-heading">
          <div className="task-section-heading learning-paths-heading">
            <div><p className="section-kicker">KEEP EXPLORING</p><h2 id="learning-paths-heading">Learning paths</h2></div>
            <Link className="section-text-link" to="/roadmaps">All roadmaps <span aria-hidden="true">→</span></Link>
          </div>
          {roadmapsLoading ? (
            <div className="learning-paths-state" role="status">Loading your learning paths…</div>
          ) : roadmapsError ? (
            <div className="learning-paths-state learning-paths-error" role="alert">
              <span>{roadmapsError}</span>
              <button className="text-button" type="button" onClick={() => { setRoadmapsError(''); setRoadmapsLoading(true); setRoadmapsReloadKey((key) => key + 1) }}>Try again</button>
            </div>
          ) : roadmaps.length ? (
            <div className="roadmap-grid dashboard-roadmap-grid">
              {roadmaps.map((roadmap) => {
                const total = Number(roadmap.total_days) || roadmap.days?.length || 0
                const done = roadmap.status === 'completed' ? total : Array.isArray(roadmap.days) ? roadmap.days.filter((day) => day.status === 'completed').length : 0
                const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0
                return (
                  <Link className="roadmap-card" to={`/roadmaps/${roadmap.id}`} key={roadmap.id}>
                    <div className="roadmap-card-top"><span className="roadmap-card-icon" aria-hidden="true">✦</span><span className={`status-badge ${roadmap.status || 'pending'}`}>{roadmap.status === 'completed' ? 'Completed' : roadmap.status === 'in_progress' ? 'In progress' : 'Active'}</span></div>
                    <h2>{roadmap.title}</h2>
                    <p className="roadmap-card-description">{roadmap.description || 'A learning plan tailored to your goals.'}</p>
                    <div className="roadmap-progress-meta"><span>{roadmap.status === 'completed' ? 'All days complete' : `Day ${roadmap.current_day || 1} of ${total}`}</span><span>{percent}%</span></div>
                    <div className="roadmap-progress-track" role="progressbar" aria-label={`${roadmap.title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="learning-paths-state">Your saved roadmaps will appear here. <Link to="/roadmaps">Explore learning paths</Link></div>
          )}
        </section>

        <Link className="assistant-entry-banner" to={assistantRoadmap ? `/roadmaps/${assistantRoadmap.id}` : '/roadmaps'}>
          <span className="assistant-entry-icon" aria-hidden="true">✦</span>
          <span className="assistant-entry-copy"><small>YOUR LEARNING COMPANION</small><strong>Have a question as you learn?</strong><span>Ask the AI Learning Assistant about a lesson or your learning plan.</span></span>
          <span className="assistant-entry-action">{assistantRoadmap ? 'Open assistant' : 'Explore roadmaps'} <span aria-hidden="true">→</span></span>
        </Link>
      </section>

      {isCreateOpen && (
        <CreateTaskModal
          key={editingTask?.id || 'new-task'}
          task={editingTask}
          onClose={() => setIsCreateOpen(false)}
          onSaved={handleTaskSaved}
        />
      )}
      {taskToDelete && (
        <DeleteTaskDialog
          task={taskToDelete}
          onCancel={() => setTaskToDelete(null)}
          onConfirm={handleDeleteTask}
        />
      )}
      </div>
    </AppShell>
  )
}

export default Dashboard