import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, LockKeyhole, X } from 'lucide-react'

export const spring = { type: 'spring', stiffness: 300, damping: 25 }

export function GlassCard({ className = '', children, ...props }) {
  return (
    <div className={`glass gradient-edge glass-hover ${className}`} {...props}>
      {children}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description, action, className = '' }) {
  return (
    <div className={`mb-5 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-amber">
            <span className="h-px w-5 bg-brand-amber/60" />
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

const ACCENTS = {
  amber: { color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.13)', glow: 'rgba(245, 158, 11, 0.35)' },
  violet: { color: 'var(--violet)', bg: 'rgba(139, 92, 246, 0.14)', glow: 'rgba(139, 92, 246, 0.35)' },
  mint: { color: 'var(--positive)', bg: 'rgba(16, 185, 129, 0.13)', glow: 'rgba(16, 185, 129, 0.3)' },
  danger: { color: 'var(--danger)', bg: 'rgba(244, 63, 94, 0.13)', glow: 'rgba(244, 63, 94, 0.3)' }
}

export function KpiCard({ label, value, sub, icon: Icon, accent = 'amber', index = 0, footer }) {
  const palette = ACCENTS[accent] || ACCENTS.amber
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.045 }}
      className="glass gradient-edge group relative overflow-hidden rounded-2xl p-4 sm:p-5"
    >
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-70" style={{ background: palette.glow }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className="tabular mt-2 truncate text-[22px] font-semibold tracking-tight text-ink sm:text-[25px]">{value}</p>
          {sub && <p className="mt-1 text-[11px] leading-4 text-muted">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: palette.bg, color: palette.color }}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
      {footer && <div className="relative mt-3">{footer}</div>}
    </motion.div>
  )
}

export function Progress({ value, accent = 'amber', className = '' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  const color = accent === 'mint' ? 'var(--positive)' : accent === 'violet' ? 'var(--violet)' : accent === 'danger' ? 'var(--danger)' : 'var(--amber-solid)'
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[var(--chip)] ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ ...spring, duration: 0.7 }}
      />
    </div>
  )
}

const BADGE_TONES = {
  settled: 'text-brand-mint bg-brand-mint/12 border-brand-mint/30',
  pending: 'text-brand-amber bg-brand-amber/12 border-brand-amber/30',
  delayed: 'text-brand-danger bg-brand-danger/12 border-brand-danger/30',
  queued: 'text-brand-violet bg-brand-violet/12 border-brand-violet/30',
  boarding: 'text-brand-amber bg-brand-amber/12 border-brand-amber/30',
  departed: 'text-brand-mint bg-brand-mint/12 border-brand-mint/30',
  reopened: 'text-brand-danger bg-brand-danger/12 border-brand-danger/30',
  neutral: 'text-muted bg-[var(--chip)] border-hairline'
}

export function StatusBadge({ status, children, className = '' }) {
  const tone = BADGE_TONES[status] || BADGE_TONES.neutral
  return (
    <span className={`chip border ${tone} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children || String(status).replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  )
}

export function LockHint({ permission, allowed }) {
  if (allowed) return null
  return (
    <span className="chip border-brand-danger/30 text-brand-danger" title={`Requires ${permission}`}>
      <LockKeyhole size={11} /> Locked
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline px-6 py-12 text-center">
      {Icon && <Icon size={26} className="mb-3 text-muted" />}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Sparkline({ values = [], color = 'var(--amber-solid)', height = 34, className = '' }) {
  const numeric = values.map((v) => Number(v) || 0)
  if (numeric.length < 2) return <div className={className} style={{ height }} />
  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const range = max - min || 1
  const points = numeric.map((v, i) => `${(i / (numeric.length - 1)) * 100},${height - 3 - ((v - min) / range) * (height - 8)}`).join(' ')
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${color.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} 100,${height}`} fill={`url(#spark-${color.replace(/\W/g, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Modal({ open, onClose, title, subtitle, children, width = 'max-w-2xl' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={spring}
            className={`glass-strong gradient-edge relative max-h-[92dvh] w-full ${width} overflow-hidden rounded-t-3xl sm:rounded-3xl`}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4 border-b border-hairline p-5 sm:p-6">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
                {subtitle && <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="btn btn-ghost !h-9 !w-9 !rounded-xl !p-0" aria-label="Close dialog">
                <X size={17} />
              </button>
            </div>
            <div className="scroll-thin max-h-[calc(92dvh-90px)] overflow-y-auto p-5 sm:p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function InlineStat({ label, value, accent = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`tabular mt-1 text-sm font-semibold ${accent ? 'text-brand-amber' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

export function ChevronLink({ children, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-amber transition hover:gap-2">
      {children} <ArrowUpRight size={14} />
    </button>
  )
}
