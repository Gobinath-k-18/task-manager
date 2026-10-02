const statusLabels = {
  pending: 'To do',
  in_progress: 'In progress',
  completed: 'Completed',
}

function formatDueDate(value) {
  if (!value) return 'No due date'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Due date unavailable'
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`
}

function TaskCard({ task, onEdit, onDelete }) {
  const status = statusLabels[task.status] ? task.status : 'pending'

  return (
    <article className="task-card">
      <div className="task-card-top">
        <h3>{task.title}</h3>
        <span className={`status-badge ${status}`}>{statusLabels[status]}</span>
      </div>
      {task.image_url && (
        <img className="task-image" src={task.image_url} alt={task.title} />
      )}
      <p className="task-description">{task.description || 'No description added.'}</p>
      <div className="task-meta">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3.5 8.2h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <time dateTime={task.due_date || undefined}>{formatDueDate(task.due_date)}</time>
      </div>
      <div className="task-card-actions">
        <button className="task-action-button edit-task-action" type="button" onClick={onEdit} aria-label={`Edit ${task.title}`}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m12.9 4.1 3 3M4 16l3.3-.7 8.4-8.4a2.1 2.1 0 0 0-3-3l-8.4 8.4L4 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>
        <button className="task-action-button delete-task-action" type="button" onClick={onDelete} aria-label={`Delete ${task.title}`}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M4.5 6h11M8 6V4h4v2m2.5 0-.6 10H6.1L5.5 6m3 3v4m3-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Delete
        </button>
      </div>
    </article>
  )
}

export default TaskCard