function Brand({ className = '' }) {
  return (
    <a className={`brand ${className}`.trim()} href="/" aria-label="Taskflow home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 3.5h5.5A3 3 0 0 1 20.5 6.5V17.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="brand-name">TaskFlow</span>
    </a>
  )
}

export default Brand