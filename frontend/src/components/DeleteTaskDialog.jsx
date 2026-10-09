import { useEffect, useRef, useState } from 'react'

function DeleteTaskDialog({
  task,
  onCancel,
  onConfirm,
  entityLabel = 'task',
  confirmationMessage,
}) {
  const cancelButtonRef = useRef(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cancelButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onCancel])

  async function handleConfirm() {
    setError('')
    setIsDeleting(true)
    try {
      await onConfirm()
    } catch {
      setError(`We couldn’t delete this ${entityLabel}. Please try again.`)
      setIsDeleting(false)
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !isDeleting) onCancel()
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section
        className="delete-confirmation-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
      >
        <span className="delete-warning-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h2 id="delete-confirmation-title">Delete this {entityLabel}?</h2>
        <p id="delete-confirmation-description">
          {confirmationMessage || (
            <><strong>{task.title}</strong> will be permanently removed. This action can’t be undone.</>
          )}
        </p>
        {error && <p className="form-alert modal-error" role="alert">{error}</p>}
        <footer className="delete-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="modal-cancel-button"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Keep {entityLabel}
          </button>
          <button
            className="delete-confirm-button"
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : `Delete ${entityLabel}`}
          </button>
        </footer>
      </section>
    </div>
  )
}

export default DeleteTaskDialog