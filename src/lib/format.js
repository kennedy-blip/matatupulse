export function localISO(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export function shiftISO(iso, days) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localISO(date)
}

const moneyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
})

export function money(value = 0) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0).replace('KES', 'KSh')
}

export function compactMoney(value = 0) {
  const n = Number(value) || 0
  if (Math.abs(n) >= 1000000) return `KSh ${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `KSh ${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return `KSh ${Math.round(n)}`
}

export function formatDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—'
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-KE', options).format(date)
}

export function formatTime(ts) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(ts))
}

export function daysUntil(iso) {
  if (!iso) return null
  const target = new Date(`${iso}T12:00:00`)
  const today = new Date(`${localISO()}T12:00:00`)
  return Math.round((target - today) / 86400000)
}

export function relativeDays(iso) {
  const days = daysUntil(iso)
  if (days === null) return 'No date set'
  if (days < 0) return `Overdue by ${Math.abs(days)}d`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  return `${days} days left`
}

export function minutesSince(ts, now = Date.now()) {
  if (!ts) return 0
  return Math.max(0, Math.floor((now - ts) / 60000))
}

export function durationLabel(minutes) {
  const m = Math.max(0, Math.floor(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'MP'
}

export function plateSlug(reg = '') {
  return reg.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

export function downloadText(filename, content, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
