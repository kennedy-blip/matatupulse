import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BellRing,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  MapPin,
  Plus,
  Radio,
  Trash2,
  UserRound,
  Users
} from 'lucide-react'
import { db } from '../db/db'
import { addDispatchEntry, deleteDispatchEntry, updateDispatchEntry } from '../db/actions'
import { useApp } from '../context/AppContext'
import { can } from '../lib/permissions'
import { durationLabel, formatTime, minutesSince } from '../lib/format'
import { spring, GlassCard, SectionHeading, KpiCard, StatusBadge, EmptyState, LockHint } from './ui'

const STAGES = ['Meru Main Stage', 'Tawakali Stage', 'Nairobi Stage', 'Embu Stage']

function useClock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function QueueCard({ entry, vehicle, now, interval, role, onAction, onDelete }) {
  const elapsed = minutesSince(entry.status === 'boarding' ? entry.calledAt || entry.createdAt : entry.createdAt, now)
  const isLate = elapsed > interval
  const status = entry.status === 'departed' ? 'departed' : isLate ? 'delayed' : entry.status

  const actions = [
    entry.status === 'queued' && { label: 'Call to bay', icon: BellRing, next: 'boarding', style: 'btn-primary' },
    entry.status === 'boarding' && { label: 'Depart', icon: ArrowRight, next: 'departed', style: 'btn-primary' },
    entry.status === 'delayed' && { label: 'Call to bay', icon: BellRing, next: 'boarding', style: 'btn-primary' },
    entry.status !== 'departed' && entry.status !== 'delayed' && { label: 'Flag late', icon: Flag, next: 'delayed', style: 'btn-ghost' }
  ].filter(Boolean)

  return (
    <motion.div layout transition={spring} className="glass gradient-edge rounded-2xl p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${isLate ? 'border-brand-danger/40 bg-brand-danger/10 text-brand-danger' : 'border-hairline bg-[var(--chip)] text-brand-amber'}`}>
          <Car size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{vehicle?.reg || entry.vehicleId}</p>
            <StatusBadge status={status}>{status === 'delayed' && !isLate ? 'Flagged late' : status}</StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">{entry.route || vehicle?.route || 'Route not set'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {entry.stage}</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={11} /> Arrived {formatTime(entry.createdAt)}</span>
            {entry.calledAt && <span className="inline-flex items-center gap-1"><Users size={11} /> Boarding {formatTime(entry.calledAt)}</span>}
            {entry.updatedBy && <span className="inline-flex items-center gap-1"><UserRound size={11} /> {entry.updatedBy}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className={`tabular text-xl font-semibold ${isLate ? 'text-brand-danger' : 'text-ink'}`}>{durationLabel(elapsed)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted">In bay</p>
        </div>
      </div>

      {entry.notes && <p className="mt-3 rounded-xl border border-hairline bg-[var(--chip)] px-3 py-2 text-[11px] text-muted">“{entry.notes}”</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button key={action.next} className={`btn ${action.style} !py-1.5 !text-[11px]`} onClick={() => onAction(entry.id, action.next)}>
              <Icon size={13} /> {action.label}
            </button>
          )
        })}
        {can(role, 'manageQueue') ? (
          <button className="btn btn-ghost ml-auto !px-2.5 !py-1.5 !text-[11px] text-brand-danger" onClick={() => onDelete(entry.id)}>
            <Trash2 size={13} /> Remove
          </button>
        ) : (
          <span className="ml-auto"><LockHint permission="manageQueue" allowed={false} /></span>
        )}
      </div>
    </motion.div>
  )
}

export default function StageDispatch({ onNavigate }) {
  const { settings, role, actor, notify, confirm } = useApp()
  const now = useClock()
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), []) || []
  const queue = useLiveQuery(() => db.dispatch.toArray(), []) || []

  const [vehicleId, setVehicleId] = useState('')
  const [stage, setStage] = useState(settings.stage || STAGES[0])
  const [notes, setNotes] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [lateOnly, setLateOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  const interval = Number(settings.dispatchIntervalMin) || 12
  const active = useMemo(() => queue.filter((entry) => entry.status !== 'departed'), [queue])
  const shown = useMemo(() => active.filter((entry) => {
    const stageMatch = stageFilter === 'all' || entry.stage === stageFilter
    const lateMatch = !lateOnly || minutesSince(entry.status === 'boarding' ? entry.calledAt || entry.createdAt : entry.createdAt, now) > interval
    return stageMatch && lateMatch
  }), [active, stageFilter, lateOnly, now, interval])
  const departed = useMemo(() => queue.filter((entry) => entry.status === 'departed').sort((a, b) => (b.departedAt || 0) - (a.departedAt || 0)).slice(0, 8), [queue])

  const delayedCount = active.filter((entry) => minutesSince(entry.status === 'boarding' ? entry.calledAt || entry.createdAt : entry.createdAt, now) > interval).length
  const avgTurnaround = departed.length
    ? Math.round(departed.reduce((total, entry) => total + (entry.turnaroundMinutes || 0), 0) / departed.length)
    : 0
  const nextVehicle = active.find((entry) => entry.stage === (stageFilter === 'all' ? settings.stage : stageFilter) && entry.status === 'queued')

  const addToQueue = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const vehicle = vehicles.find((v) => v.id === vehicleId)
      await addDispatchEntry({ vehicleId, stage, route: vehicle?.route || '', notes }, actor)
      notify(`${vehicle?.reg || vehicleId} added to the ${stage} queue.`)
      setNotes('')
      setVehicleId('')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (id, status) => {
    try {
      const updated = await updateDispatchEntry(id, { status }, actor)
      if (status === 'departed') notify(`${updated.vehicleId} departed · turnaround ${durationLabel(updated.turnaroundMinutes || 0)}.`)
      else if (status === 'boarding') notify(`${updated.vehicleId} called to the boarding bay.`)
      else notify(`${updated.vehicleId} flagged as delayed.`, 'warning')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const removeEntry = async (id) => {
    const ok = await confirm({
      title: 'Remove from queue?',
      message: 'The dispatch entry will be permanently removed from this device.',
      confirmLabel: 'Remove entry',
      danger: true
    })
    if (!ok) return
    try {
      await deleteDispatchEntry(id, actor)
      notify('Dispatch entry removed.', 'info')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const callNext = async () => {
    if (!nextVehicle) return
    await changeStatus(nextVehicle.id, 'boarding')
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Stage operations"
        title="Stage Dispatch & Queue Timer"
        description="Track departure intervals, turnaround times and delayed-route flags, live at the terminus."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip"><Radio size={12} className="text-brand-mint" /> {formatTime(now)} EAT</span>
            <button className="btn btn-primary" onClick={callNext} disabled={!nextVehicle}>
              <BellRing size={15} /> Call next vehicle
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="In the queue" value={active.length} sub={`${shown.length} shown by current filter`} icon={Users} accent="violet" />
        <KpiCard index={1} label="Delayed vehicles" value={delayedCount} sub={`Beyond ${interval} min interval`} icon={Flag} accent={delayedCount ? 'danger' : 'mint'} />
        <KpiCard index={2} label="Avg turnaround" value={durationLabel(avgTurnaround)} sub="Across recent departures" icon={Clock3} accent="amber" />
        <KpiCard index={3} label="Next departure" value={nextVehicle ? vehicles.find((v) => v.id === nextVehicle.vehicleId)?.reg || nextVehicle.vehicleId : '—'} sub={nextVehicle ? `Waiting at ${nextVehicle.stage}` : 'No vehicle queued'} icon={CheckCircle2} accent="mint" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <GlassCard className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <select className="field !pl-9" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                  <option value="all">All stages</option>
                  {STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
              <button
                onClick={() => setLateOnly((value) => !value)}
                className={`btn !py-2 !text-[11px] ${lateOnly ? 'border-brand-danger/50 bg-brand-danger/12 text-brand-danger' : 'btn-ghost'}`}
              >
                <Flag size={13} /> Delayed only
              </button>
              <span className="chip">Target interval · {interval} min</span>
            </div>

            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {shown.map((entry) => (
                  <QueueCard
                    key={entry.id}
                    entry={entry}
                    vehicle={vehicles.find((v) => v.id === entry.vehicleId)}
                    now={now}
                    interval={interval}
                    role={role}
                    onAction={changeStatus}
                    onDelete={removeEntry}
                  />
                ))}
              </AnimatePresence>
              {!shown.length && (
                <EmptyState
                  icon={Radio}
                  title={lateOnly ? 'No delayed vehicles right now' : 'Queue is clear'}
                  description="Add a vehicle from the stage console or switch the stage filter to see other bays."
                  action={<button className="btn btn-ghost" onClick={() => { setLateOnly(false); setStageFilter('all') }}>Show all vehicles</button>}
                />
              )}
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Turnaround log</p>
                <h3 className="mt-1 text-sm font-semibold text-ink">Recently departed</h3>
              </div>
              <span className="chip">{departed.length} entries</span>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-y border-hairline bg-[var(--chip)]">
                    <th className="table-head px-5 py-2.5">Vehicle</th>
                    <th className="table-head px-3 py-2.5">Stage</th>
                    <th className="table-head px-3 py-2.5">Called</th>
                    <th className="table-head px-3 py-2.5">Departed</th>
                    <th className="table-head px-3 py-2.5">Turnaround</th>
                    <th className="table-head px-3 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody>
                  {departed.map((entry) => (
                    <tr key={entry.id} className="border-b border-hairline/60 text-[11px]">
                      <td className="px-5 py-2.5 font-semibold text-ink">{vehicles.find((v) => v.id === entry.vehicleId)?.reg || entry.vehicleId}</td>
                      <td className="px-3 py-2.5 text-muted">{entry.stage}</td>
                      <td className="tabular px-3 py-2.5 text-muted">{formatTime(entry.calledAt)}</td>
                      <td className="tabular px-3 py-2.5 text-muted">{formatTime(entry.departedAt)}</td>
                      <td className="tabular px-3 py-2.5 font-semibold text-brand-mint">{durationLabel(entry.turnaroundMinutes || 0)}</td>
                      <td className="px-3 py-2.5 text-muted">{entry.updatedBy || '—'}</td>
                    </tr>
                  ))}
                  {!departed.length && <tr><td colSpan={6} className="px-5 py-7 text-center text-xs text-muted">No departures recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="h-fit p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Stage console</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Add vehicle to queue</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted">Marshals can log arrivals and update dispatch times without a network connection.</p>
          <form onSubmit={addToQueue} className="mt-4 space-y-3">
            <div>
              <label className="label">Vehicle</label>
              <select className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
                <option value="">Select vehicle…</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.reg} · {v.route}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Stage / bay</label>
              <select className="field" value={stage} onChange={(e) => setStage(e.target.value)}>
                {STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Marshal note <span className="normal-case tracking-normal text-muted">(optional)</span></label>
              <textarea className="field min-h-[76px] resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Awaiting driver, bay 2" />
            </div>
            <button className="btn btn-primary w-full" disabled={saving || !vehicleId} type="submit">
              {saving ? 'Adding…' : <><Plus size={15} /> Add to queue</>}
            </button>
          </form>
          <div className="divider my-4" />
          <div className="rounded-xl border border-hairline bg-[var(--chip)] p-3">
            <p className="text-[11px] font-semibold text-ink">Interval policy</p>
            <p className="mt-1 text-[10px] leading-4 text-muted">A vehicle is flagged delayed after {interval} minutes in the bay. {can(role, 'manageQueue') ? 'You can change this in Settings.' : 'Only the fleet owner can change this baseline.'}</p>
            {can(role, 'manageQueue') && <button className="mt-2 text-[11px] font-semibold text-brand-amber hover:underline" onClick={() => onNavigate?.('settings')}>Open settings <ChevronRight size={12} className="inline" /></button>}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
