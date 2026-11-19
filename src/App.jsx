import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity,
  ChevronRight,
  CircleUserRound,
  Download,
  Gauge,
  Radio,
  Settings2,
  ShieldCheck,
  WalletCards,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from './db/db'
import { useApp } from './context/AppContext'
import { ROLES } from './lib/permissions'
import { formatDate, localISO } from './lib/format'
import { spring } from './components/ui'
import RemittanceLedger from './components/RemittanceLedger'
import StageDispatch from './components/StageDispatch'
import FleetCompliance from './components/FleetCompliance'
import SettingsView from './components/SettingsView'

const NAV = [
  { id: 'remittance', label: 'Remittance Ledger', short: 'Remittance', icon: WalletCards, hint: 'Collections, expenses & net owed' },
  { id: 'dispatch', label: 'Stage Dispatch', short: 'Dispatch', icon: Radio, hint: 'Live queue & turnaround timers' },
  { id: 'fleet', label: 'Fleet Health', short: 'Fleet Health', icon: Activity, hint: 'Service, NTSA & insurance' },
  { id: 'settings', label: 'Settings & APK', short: 'Settings', icon: Settings2, hint: 'Roles, themes & offline data' }
]

export function BrandMark({ size = 38 }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-400 via-orange-500 to-violet-600 shadow-[0_8px_24px_-8px_var(--amber-glow)]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size * 0.68} height={size * 0.68} fill="none" aria-hidden="true">
        <path d="M8 24h24M10 24l2.5-8h15L30 24" stroke="#130b02" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="27" r="2.6" fill="#130b02" />
        <circle cx="26" cy="27" r="2.6" fill="#130b02" />
        <path d="M13.5 19.5h13" stroke="#130b02" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 9v4M20 5.5v1.8" stroke="#130b02" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function ConnectionBadge() {
  const { online } = useApp()
  return (
    <span className={`chip ${online ? 'text-brand-mint' : 'text-brand-amber'}`}>
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      {online ? 'Online' : 'Offline ready'}
    </span>
  )
}

function Sidebar({ tab, setTab }) {
  const { role } = useApp()
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])
  const activeCount = vehicles?.filter((v) => v.active).length || 0

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[262px] flex-col border-r border-hairline bg-[var(--surface-strong)] px-4 py-6 backdrop-blur-2xl lg:flex">
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight text-ink">Matatu<span className="text-brand-amber">Pulse</span></p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Fleet Command OS</p>
        </div>
      </div>

      <div className="mt-8 px-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Command centre</p>
      </div>
      <nav className="mt-3 space-y-1.5">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={spring}
                  className="absolute inset-0 rounded-2xl border border-hairline bg-[var(--chip)]"
                />
              )}
              <Icon size={17} className={`relative ${active ? 'text-brand-amber' : ''}`} />
              <span className="relative flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="relative text-brand-amber" />}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="glass rounded-2xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Fleet snapshot</p>
            <Gauge size={14} className="text-brand-amber" />
          </div>
          <p className="tabular mt-2 text-2xl font-semibold text-ink">{activeCount}<span className="ml-1 text-xs font-normal text-muted">active PSVs</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vehicles?.map((vehicle) => (
              <span key={vehicle.id} className="chip !px-1.5 !py-0.5 !text-[9px]">{vehicle.reg}</span>
            )) || <span className="chip">Loading…</span>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-[var(--chip)] px-3 py-2.5">
          <CircleUserRound size={17} className="text-brand-violet" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-ink">{ROLES[role].short}</p>
            <p className="truncate text-[10px] text-muted">Privileges active</p>
          </div>
          <ShieldCheck size={14} className="text-brand-mint" />
        </div>
        <p className="px-2 text-[9px] leading-4 text-muted">Local-first · Data never leaves this device unless you export it.</p>
      </div>
    </aside>
  )
}

function TopBar({ tab, setTab }) {
  const { role, settings, actor } = useApp()
  const active = NAV.find((item) => item.id === tab) || NAV[0]

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-hairline bg-[var(--bg)]/80 px-4 py-3.5 backdrop-blur-xl sm:-mx-7 sm:px-7 lg:static lg:mx-0 lg:mb-6 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 lg:block">
          <div className="lg:hidden"><BrandMark size={34} /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-ink sm:text-2xl">{active.label}</h1>
              <span className="hidden lg:inline-flex"><ConnectionBadge /></span>
            </div>
            <p className="hidden truncate text-[13px] text-muted sm:block lg:mt-1">{active.hint} · {settings.ownerName}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-right text-[11px] text-muted xl:block">{formatDate(localISO(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <div className="lg:hidden"><ConnectionBadge /></div>
          <button className="btn btn-ghost hidden !px-3 sm:inline-flex" onClick={() => setTab('settings')} title="Open APK center">
            <Download size={15} /> <span className="hidden md:inline">APK Center</span>
          </button>
          <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-[var(--chip)] px-2.5 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-violet/20 text-[9px] font-bold text-brand-violet">
              {actor.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-semibold leading-tight text-ink">{ROLES[role].short}</p>
              <p className="text-[9px] leading-tight text-muted">Signed in locally</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function BottomNav({ tab, setTab }) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-[var(--surface-strong)] px-2 pt-2 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button key={item.id} onClick={() => setTab(item.id)} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2">
              {active && <motion.span layoutId="bottom-active" transition={spring} className="absolute inset-0 rounded-2xl bg-[var(--chip)]" />}
              <Icon size={19} className={`relative ${active ? 'text-brand-amber' : 'text-muted'}`} />
              <span className={`relative truncate text-[9.5px] font-semibold ${active ? 'text-ink' : 'text-muted'}`}>{item.short}</span>
              {active && <motion.span layoutId="bottom-dot" transition={spring} className="absolute -top-0.5 h-1 w-6 rounded-full bg-brand-amber" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default function App() {
  const [tab, setTab] = useState('remittance')
  const changeTab = (next) => {
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const view = useMemo(() => ({
    remittance: <RemittanceLedger onNavigate={changeTab} />,
    dispatch: <StageDispatch onNavigate={changeTab} />,
    fleet: <FleetCompliance onNavigate={changeTab} />,
    settings: <SettingsView onNavigate={changeTab} />
  })[tab], [tab])

  return (
    <>
      <div className="mesh-stage" aria-hidden="true">
        <div className="mesh-blob mesh-blob-one" />
        <div className="mesh-blob mesh-blob-two" />
        <div className="mesh-blob mesh-blob-three" />
        <div className="scanline" />
      </div>
      <Sidebar tab={tab} setTab={changeTab} />
      <div className="lg:pl-[262px]">
        <main className="mx-auto max-w-[1560px] px-4 pb-28 pt-4 sm:px-7 sm:pt-6 lg:pb-10">
          <TopBar tab={tab} setTab={changeTab} />
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 14, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={spring}
            >
              {view}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <BottomNav tab={tab} setTab={changeTab} />
    </>
  )
}
