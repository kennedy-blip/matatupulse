import { motion } from 'framer-motion'
import { Contrast, MoonStar, Sun } from 'lucide-react'
import { updateSettings } from '../db/actions'
import { useApp } from '../context/AppContext'
import { spring, GlassCard } from './ui'

const THEMES = [
  { id: 'neon', label: 'Night Stage Neon', short: 'Neon', icon: MoonStar, hint: 'Obsidian glass with amber & violet glow' },
  { id: 'daylight', label: 'Daylight Commute', short: 'Daylight', icon: Sun, hint: 'Frosted milk glass with emerald profit badges' },
  { id: 'terminal', label: 'High-Contrast Terminal', short: 'Terminal', icon: Contrast, hint: 'Amber on black for direct midday sunlight' }
]

export default function ThemeToggle({ compact = false }) {
  const { settings, actor, notify } = useApp()

  const choose = async (id) => {
    if (id === settings.theme) return
    try {
      await updateSettings({ theme: id }, actor)
      notify(`${THEMES.find((t) => t.id === id).label} theme applied.`, 'info')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  if (compact) {
    return (
      <div className="flex rounded-xl border border-hairline bg-[var(--chip)] p-1">
        {THEMES.map((theme) => {
          const Icon = theme.icon
          const active = settings.theme === theme.id
          return (
            <button key={theme.id} onClick={() => choose(theme.id)} title={theme.label} className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}>
              {active && <motion.span layoutId="compact-theme" transition={spring} className="absolute inset-0 rounded-lg border border-hairline bg-[var(--surface-hover)]" />}
              <Icon size={15} className="relative" />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Theme engine</p>
      <h3 className="mt-1 text-base font-semibold text-ink">Pick your stage lighting</h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {THEMES.map((theme) => {
          const Icon = theme.icon
          const active = settings.theme === theme.id
          return (
            <button
              key={theme.id}
              onClick={() => choose(theme.id)}
              className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${active ? 'border-brand-amber/50' : 'border-hairline hover:border-hairline'}`}
              aria-pressed={active}
            >
              {active && <motion.span layoutId="theme-card" transition={spring} className="absolute inset-0 bg-brand-amber/[0.08]" />}
              <div className="relative flex items-center justify-between">
                <Icon size={18} className={active ? 'text-brand-amber' : 'text-muted'} />
                {active && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="h-2 w-2 rounded-full bg-brand-amber" />}
              </div>
              <p className="relative mt-3 text-[12px] font-semibold text-ink">{theme.short}</p>
              <p className="relative mt-1 text-[10px] leading-4 text-muted">{theme.hint}</p>
            </button>
          )
        })}
      </div>
    </GlassCard>
  )
}
