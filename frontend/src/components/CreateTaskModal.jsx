import { useEffect, useRef, useState } from 'react'
import api from '../api/api'

const titleValidationMessage = 'Please enter a task title before saving.'
const fileSizeLimit = 5 * 1024 * 1024
const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp'])
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function CreateTaskModal({ task, onClose, onSaved }) {
  const isEditing = Boolean(task)
  const titleRef = useRef(null)
  const imageInputRef = useRef(null)
  const previewObjectUrlRef = useRef(null)
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState(task?.status || 'pending')
  const [dueDate, setDueDate] = useState(task?.due_date ? String(task.due_date).slice(0, 10) : '')
  const [imageUrl, setImageUrl] = useState(task?.image_url || '')
  const [selectedImage, setSelectedImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(task?.image_url || '')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSubmitting && !isUploading) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, isUploading, onClose])

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
  }, [])

  async function handleImageSelection(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const extensionIndex = file.name.lastIndexOf('.')
    const extension = extensionIndex > 0 ? file.name.slice(extensionIndex + 1).toLowerCase() : ''
    if (!allowedImageExtensions.has(extension) || (file.type && !allowedImageTypes.has(file.type))) {
      setError('Choose a JPG, JPEG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > fileSizeLimit) {
      setError('The image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
    const objectUrl = URL.createObjectURL(file)
    previewObjectUrlRef.current = objectUrl
    setSelectedImage(file)
    setPreviewUrl(objectUrl)
    setError('')

    const imageData = new FormData()
    imageData.append('image', file)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const { data } = await api.post('/upload', imageData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
          }
        },
      })
      if (typeof data?.imageUrl !== 'string' || !data.imageUrl.startsWith('https://')) {
        throw new Error('Upload response did not include a secure image URL')
      }

      setImageUrl(data.imageUrl)
      setPreviewUrl(data.imageUrl)
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    } catch (uploadError) {
      if (uploadError.response?.status === 413) {
        setError('The image must be 5 MB or smaller.')
      } else if (uploadError.response?.status === 415) {
        setError('Choose a JPG, JPEG, PNG, or WebP image.')
      } else {
        setError('We couldn’t upload this image. Please try again.')
      }
      setSelectedImage(null)
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
      setPreviewUrl(imageUrl)
      if (imageInputRef.current) imageInputRef.current.value = ''
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isUploading || isSubmitting) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(titleValidationMessage)
      titleRef.current?.focus()
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const taskData = {
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        due_date: dueDate || null,
        image_url: imageUrl.trim() || null,
      }
      if (isEditing) {
        await api.put(`/tasks/${task.id}`, taskData)
      } else {
        await api.post('/tasks', taskData)
      }
      await onSaved(isEditing ? 'updated' : 'created')
    } catch {
      setError(isEditing
        ? 'We couldn’t update this task. Please try again.'
        : 'We couldn’t create this task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !isSubmitting && !isUploading) onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section
        className="create-task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        aria-describedby="create-task-description"
      >
        <header className="modal-header">
          <div>
            <p className="modal-eyebrow">{isEditing ? 'Update your task' : 'A new priority'}</p>
            <h2 id="create-task-title">{isEditing ? 'Edit task' : 'Create a task'}</h2>
            <p id="create-task-description">
              {isEditing ? 'Make the changes you need and save your task.' : 'Add the details and we’ll make a place for it.'}
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
            aria-label="Close task form"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {error && error !== titleValidationMessage && <p className="form-alert modal-error" role="alert">{error}</p>}

        <form className="task-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="task-title">Title <span aria-hidden="true">*</span></label>
            <input
              ref={titleRef}
              id="task-title"
              name="title"
              type="text"
              maxLength={255}
              placeholder="What needs to get done?"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                if (error === titleValidationMessage) setError('')
              }}
              aria-required="true"
              aria-invalid={Boolean(error && !title.trim())}
              aria-describedby={error && !title.trim() ? 'task-title-error' : undefined}
            />
            {error === titleValidationMessage && !title.trim() && <span id="task-title-error" className="field-error">{error}</span>}
          </div>

          <div className="field">
            <label htmlFor="task-description">Description <span className="optional-label">Optional</span></label>
            <textarea
              id="task-description"
              name="description"
              rows="3"
              placeholder="Add a little more context..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="task-form-row">
            <div className="field">
              <label htmlFor="task-status">Status</label>
              <select id="task-status" name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-due-date">Due date <span className="optional-label">Optional</span></label>
              <input
                id="task-due-date"
                name="due_date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="task-image-file">Image <span className="optional-label">Optional</span></label>
            <input
              ref={imageInputRef}
              id="task-image-file"
              name="image"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleImageSelection}
              disabled={isSubmitting || isUploading}
            />
            <span className="image-file-name" aria-live="polite">
              {selectedImage?.name || (imageUrl ? 'Current image will be kept unless replaced.' : 'No image selected')}
            </span>
            {previewUrl && (
              <div className="image-preview">
                <img src={previewUrl} alt={selectedImage ? `Preview of ${selectedImage.name}` : 'Current task image'} />
                <span>{selectedImage ? 'New image preview' : 'Current task image'}</span>
              </div>
            )}
            {isUploading && (
              <div className="upload-progress" role="status" aria-live="polite">
                <span>Uploading image… {uploadProgress}%</span>
                <progress max="100" value={uploadProgress} aria-label="Image upload progress" />
              </div>
            )}
          </div>

          <footer className="modal-actions">
            <button className="modal-cancel-button" type="button" onClick={onClose} disabled={isSubmitting || isUploading}>Cancel</button>
            <button className="create-task-submit" type="submit" disabled={isSubmitting || isUploading}>
              {isUploading
                ? `Uploading image… ${uploadProgress}%`
                : isSubmitting
                  ? (isEditing ? 'Saving…' : 'Creating…')
                  : (isEditing ? 'Save changes' : 'Create task')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default CreateTaskModal