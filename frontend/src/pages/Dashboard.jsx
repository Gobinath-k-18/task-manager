import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import api from '../api/api'
import { clearAuth, getUser } from '../api/authStorage'
import Brand from '../components/Brand'
import CreateTaskModal from '../components/CreateTaskModal'
import DeleteTaskDialog from '../components/DeleteTaskDialog'
import TaskCard from '../components/TaskCard'

function Dashboard({ theme, onToggleTheme }) {
  const navigate = useNavigate()
  const user = getUser()
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === 'completed').length,
    [tasks],
  )
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

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
  const initials = user?.name?.trim().charAt(0) || 'U'

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

      <section className="dashboard-content" aria-labelledby="dashboard-title">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR WORKSPACE</p>
            <h1 id="dashboard-title">A good day, {firstName}.</h1>
            <p>Here’s what’s on your plate. One thing at a time.</p>
          </div>
          <div className="summary-card" aria-label={`${completedCount} of ${tasks.length} tasks completed`}>
            <span className="summary-icon" aria-hidden="true">✓</span>
            <span>
              <strong className="summary-number">{completedCount}<span className="summary-label"> / {tasks.length} completed</span></strong>
              <span className="summary-label">Your progress</span>
            </span>
          </div>
        </div>

        <div className="task-section-heading">
          <h2 id="tasks-heading">Your tasks</h2>
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
    </main>
  )
}

export default Dashboard