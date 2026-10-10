import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatWithAssistant } from '../api/api'
import { clearAuth } from '../api/authStorage'
import { getAssistantErrorMessage, parseAssistantContent } from '../utils/assistantFormatting'

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! I’m your TaskFlow assistant. Ask about a learning concept, your current lesson, or how to approach a task.',
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.25v2.5m-6.25 2h12.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 12.25h.01m7-.01h.01M9 16h6m-13-3.75h1.75m16.5 0H22" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function AssistantContent({ content }) {
  const blocks = parseAssistantContent(content)

  return (
    <div className="floating-assistant-rich-content">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <strong className="floating-assistant-rich-heading" key={`heading-${index}`}>{block.text}</strong>
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul'
          return (
            <List className="floating-assistant-rich-list" key={`list-${index}`}>
              {block.items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{item}</li>)}
            </List>
          )
        }
        if (block.type === 'table') {
          return (
            <dl className="floating-assistant-markdown-table" key={`table-${index}`}>
              {block.rows.map((row, rowIndex) => (
                <div className="floating-assistant-table-row" key={`row-${rowIndex}`}>
                  {block.headers.map((header, cellIndex) => (
                    <div className="floating-assistant-table-cell" key={`cell-${cellIndex}`}>
                      <dt>{header || `Column ${cellIndex + 1}`}</dt>
                      <dd>{row[cellIndex] || '—'}</dd>
                    </div>
                  ))}
                </div>
              ))}
            </dl>
          )
        }
        return <p key={`paragraph-${index}`}>{block.text}</p>
      })}
    </div>
  )
}

function FloatingAssistant() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([welcomeMessage])
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [retryMessage, setRetryMessage] = useState('')
  const inFlightRef = useRef(false)
  const sequenceRef = useRef(0)
  const inputRef = useRef(null)
  const messagesRef = useRef(null)

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isSending])

  function addMessage(role, content) {
    sequenceRef.current += 1
    setMessages((current) => [
      ...current,
      { id: `assistant-chat-${sequenceRef.current}`, role, content },
    ].slice(-50))
  }

  async function sendMessage(text, isRetry = false) {
    const trimmed = text.trim()
    if (!trimmed || inFlightRef.current) return

    inFlightRef.current = true
    setIsSending(true)
    setError('')
    if (!isRetry) addMessage('user', trimmed)

    try {
      const { data } = await chatWithAssistant(trimmed)
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error('The assistant returned an empty response.')
      }
      addMessage('assistant', data.answer.trim())
      setMessage('')
      setRetryMessage('')
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth()
        navigate('/login', { replace: true })
        return
      }
      setRetryMessage(trimmed)
      setError(getAssistantErrorMessage(requestError))
    } finally {
      inFlightRef.current = false
      setIsSending(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendMessage(message)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage(message)
    }
  }

  return (
    <div className="floating-assistant-root">
      <section
        className={`floating-assistant-panel${isOpen ? ' is-open' : ''}`}
        aria-label="TaskFlow AI assistant"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <header className="floating-assistant-header">
          <span className="floating-assistant-avatar"><BotIcon /></span>
          <div className="floating-assistant-heading">
            <strong>TaskFlow Assistant</strong>
            <span><i aria-hidden="true" /> Learning and task support</span>
          </div>
          <button
            className="floating-assistant-close"
            type="button"
            aria-label="Close assistant"
            onClick={() => setIsOpen(false)}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        </header>

        <div className="floating-assistant-context-note">Uses your current learning plan and open tasks when available.</div>

        <div className="floating-assistant-messages" ref={messagesRef} role="log" aria-live="polite" aria-label="Assistant conversation">
          {messages.map((chatMessage) => (
            <article className={`floating-assistant-message ${chatMessage.role}`} key={chatMessage.id}>
              <span>{chatMessage.role === 'user' ? 'You' : 'Assistant'}</span>
              <AssistantContent content={chatMessage.content} />
            </article>
          ))}
          {isSending && (
            <div className="floating-assistant-message assistant" role="status">
              <span>Assistant</span>
              <p className="assistant-thinking"><i /><i /><i /><span className="visually-hidden">Thinking…</span></p>
            </div>
          )}
        </div>

        {error && (
          <div className="floating-assistant-error" role="alert">
            <span>{error}</span>
            <button type="button" disabled={isSending || !retryMessage} onClick={() => sendMessage(retryMessage, true)}>Retry</button>
          </div>
        )}

        <form className="floating-assistant-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="floating-assistant-input">Message the TaskFlow assistant</label>
          <textarea
            id="floating-assistant-input"
            ref={inputRef}
            rows={2}
            maxLength={2000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            disabled={isSending}
          />
          <button type="submit" aria-label="Send message" disabled={isSending || !message.trim()}>
            {isSending ? <span className="assistant-send-spinner" aria-hidden="true" /> : <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        </form>
        <p className="floating-assistant-hint">Enter to send · Shift+Enter for a new line</p>
      </section>

      <button
        className={`floating-assistant-trigger${isOpen ? ' is-open' : ''}`}
        type="button"
        aria-label={isOpen ? 'Close TaskFlow AI assistant' : 'Open TaskFlow AI assistant'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <BotIcon />
      </button>
    </div>
  )
}

export default FloatingAssistant
