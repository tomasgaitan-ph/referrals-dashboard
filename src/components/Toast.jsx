import { useEffect, useState } from 'react'

export default function Toast({ message, type = 'success', onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = requestAnimationFrame(() => setVisible(true))
    const closeTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 4000)
    return () => {
      cancelAnimationFrame(showTimer)
      clearTimeout(closeTimer)
    }
  }, [onClose])

  const isSuccess = type === 'success'

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-lg transition-all duration-300 max-w-sm ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      } ${
        isSuccess
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isSuccess ? (
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 9 17.25l10.5-10.5" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        )}
      </span>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
        className="shrink-0 text-current opacity-50 hover:opacity-80 transition-opacity active:scale-95"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
