import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X, XCircle } from 'lucide-react'
import { db, DEFAULT_SETTINGS } from '../db/db'

const AppContext = createContext(null)

const spring = { type: 'spring', stiffness: 300, damping: 25 }

const TONES = {
  success: { icon: CheckCircle2, className: 'text-brand-mint' },
  error: { icon: XCircle, className: 'text-brand-danger' },
  info: { icon: Info, className: 'text-brand-violet' },
  warning: { icon: AlertTriangle, className: 'text-brand-amber' }
}

export function AppProvider({ children }) {
  const rows = useLiveQuery(() => db.settings.toArray(), [], null)
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...Object.fromEntries((rows || []).map((row) => [row.key, row.value])) }),
    [rows]
  )
  const role = settings.role || 'owner'
  const actor = useMemo(
    () => ({ name: settings.operatorName || 'Grace Wambui', role }),
    [settings.operatorName, role]
  )

  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const idRef = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || 'neon'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', settings.theme === 'daylight' ? '#eef2f7' : '#090a0f')
  }, [settings.theme])

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (!confirmState) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') finishConfirm(false)
      if (event.key === 'Enter') finishConfirm(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmState])

  const dismissToast = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const notify = useCallback((message, tone = 'success') => {
    const id = ++idRef.current
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 4200)
  }, [dismissToast])

  const confirm = useCallback((options) => new Promise((resolve) => {
    setConfirmState({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      danger: Boolean(options.danger),
      resolve
    })
  }), [])

  const finishConfirm = useCallback((result) => {
    setConfirmState((current) => {
      current?.resolve(result)
      return null
    })
  }, [])

  const value = useMemo(() => ({ settings, role, actor, online, notify, confirm }), [settings, role, actor, online, notify, confirm])

  return (
    <AppContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => {
            const tone = TONES[toast.tone] || TONES.success
            const Icon = tone.icon
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.94 }}
                transition={spring}
                className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl border-hairline p-3.5"
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${tone.className}`} />
                <p className="flex-1 text-[13px] leading-5 text-ink">{toast.message}</p>
                <button onClick={() => dismissToast(toast.id)} className="text-muted transition hover:text-ink" aria-label="Dismiss notification">
                  <X size={15} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmState && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => finishConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={spring}
              className="glass-strong gradient-edge relative w-full max-w-md rounded-3xl p-6"
              role="alertdialog"
              aria-modal="true"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${confirmState.danger ? 'bg-brand-danger/15 text-brand-danger' : 'bg-brand-amber/15 text-brand-amber'}`}>
                <ShieldAlert size={22} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-ink">{confirmState.title}</h3>
              {confirmState.message && <p className="mt-2 text-sm leading-6 text-muted">{confirmState.message}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button className="btn btn-ghost" onClick={() => finishConfirm(false)}>Cancel</button>
                <button
                  className={`btn ${confirmState.danger ? 'bg-brand-danger text-black' : 'btn-primary'}`}
                  onClick={() => finishConfirm(true)}
                  autoFocus
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
