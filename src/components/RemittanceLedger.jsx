import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  Download,
  Fuel,
  LockKeyhole,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { db } from '../db/db'
import {
  addExpense,
  addTrip,
  deleteLedgerEntry,
  reopenRemittance,
  settleRemittance
} from '../db/actions'
import { useApp } from '../context/AppContext'
import { can } from '../lib/permissions'
import { csvEscape, downloadText, formatDate, localISO, money, shiftISO } from '../lib/format'
import { spring, GlassCard, SectionHeading, KpiCard, Progress, StatusBadge, Sparkline, EmptyState, InlineStat } from './ui'

const RANGES = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: 'all', label: 'All', days: null }
]

const CATEGORIES = ['Fuel', 'Stage Fee', 'Car Wash', 'Squad', 'Repairs', 'Other']

const CATEGORY_ICON = {
  Fuel: Fuel,
  'Stage Fee': Receipt,
  'Car Wash': Car,
  Squad: Users,
  Repairs: Car,
  Other: Receipt
}

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

function SettledStamp() {
  return (
    <motion.div
      initial={{ scale: 0.55, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ ...spring, delay: 0.08 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-mint/40 bg-brand-mint/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-mint"
    >
      <BadgeCheck size={13} /> Settled
    </motion.div>
  )
}

function EntryForm({ vehicles, settings, onSaved, compact = false }) {
  const { role, actor, notify } = useApp()
  const [kind, setKind] = useState('trip')
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '')
  const [date, setDate] = useState(localISO())
  const [route, setRoute] = useState(vehicles[0]?.route || '')
  const [rounds, setRounds] = useState(3)
  const [passengers, setPassengers] = useState(11)
  const [fare, setFare] = useState(450)
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('Fuel')
  const [amount, setAmount] = useState('')
  const [receiptNo, setReceiptNo] = useState('')
  const [saving, setSaving] = useState(false)

  const activeVehicleId = vehicles.some((v) => v.id === vehicleId) ? vehicleId : vehicles[0]?.id || ''
  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId)
  const tripPreview = Math.max(1, Math.floor(rounds) || 1) * Math.max(1, Math.floor(passengers) || 0) * Math.max(1, Math.floor(fare) || 0)
  const overLimit = kind === 'expense' && Number(amount) > (settings.expenseLimit || 0)

  const pickVehicle = (id) => {
    setVehicleId(id)
    const vehicle = vehicles.find((v) => v.id === id)
    if (vehicle) setRoute(vehicle.route)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (kind === 'trip') {
        await addTrip({ vehicleId: activeVehicleId, date, route, rounds, passengers, fare, note }, actor)
        notify(`${activeVehicle?.reg || activeVehicleId} · ${money(tripPreview)} collected and saved offline.`)
      } else {
        await addExpense({ vehicleId: activeVehicleId, date, category, amount, receiptNo, note }, actor)
        notify(`${category} expense of ${money(Number(amount))} recorded.`)
      }
      setNote('')
      setReceiptNo('')
      setAmount('')
      onSaved?.()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassCard className={`p-4 sm:p-5 ${compact ? '' : 'h-full'}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Field capture</p>
          <h3 className="mt-1 text-base font-semibold text-ink">New ledger entry</h3>
        </div>
        <div className="flex rounded-xl border border-hairline bg-[var(--chip)] p-1">
          {[
            { id: 'trip', label: 'Collection' },
            { id: 'expense', label: 'Expense' }
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setKind(option.id)}
              className={`relative rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${kind === option.id ? 'text-ink' : 'text-muted'}`}
            >
              {kind === option.id && <motion.span layoutId="entry-kind" transition={spring} className="absolute inset-0 rounded-lg border border-hairline bg-[var(--surface-hover)]" />}
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Vehicle</label>
            <select className="field" value={activeVehicleId} onChange={(e) => pickVehicle(e.target.value)}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.reg}</option>)}
              {!vehicles.length && <option value="">No vehicle</option>}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        {kind === 'trip' ? (
          <>
            <div>
              <label className="label">Route</label>
              <input className="field" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Meru ↔ Nairobi" required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Rounds</label>
                <input className="field tabular" type="number" min="1" max="20" value={rounds} onChange={(e) => setRounds(e.target.value)} required />
              </div>
              <div>
                <label className="label">Pax / trip</label>
                <input className="field tabular" type="number" min="1" max={activeVehicle?.capacity || 20} value={passengers} onChange={(e) => setPassengers(e.target.value)} required />
              </div>
              <div>
                <label className="label">Fare (KSh)</label>
                <input className="field tabular" type="number" min="1" value={fare} onChange={(e) => setFare(e.target.value)} required />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-brand-amber/25 bg-brand-amber/[0.07] px-3 py-2">
              <span className="text-[11px] text-muted">Gross collection</span>
              <span className="tabular text-sm font-semibold text-brand-amber">{money(tripPreview)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Amount (KSh)</label>
                <input className="field tabular" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="6800" required />
              </div>
            </div>
            <div>
              <label className="label">Receipt no. <span className="normal-case tracking-normal text-muted">(optional)</span></label>
              <input className="field" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="RCP-1042" />
            </div>
            {overLimit && (
              <div className="flex items-center gap-2 rounded-xl border border-brand-danger/30 bg-brand-danger/10 px-3 py-2 text-[11px] text-brand-danger">
                <LockKeyhole size={13} /> Above the {money(settings.expenseLimit)} expense limit — this entry will be flagged for audit.
              </div>
            )}
          </>
        )}

        <div>
          <label className="label">Note <span className="normal-case tracking-normal text-muted">(optional)</span></label>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'trip' ? 'Evening peak round' : 'Fuel at Shell Meru'} />
        </div>

        <button className="btn btn-primary w-full" type="submit" disabled={saving || !activeVehicleId}>
          {saving ? 'Saving…' : <><Plus size={16} /> {kind === 'trip' ? 'Save trip collection' : 'Record expense'}</>}
        </button>
        <p className="text-center text-[10px] text-muted">
          {can(role, 'logTrips') ? 'Saved to this device instantly — works with zero network.' : 'Read-only role.'}
        </p>
      </form>
    </GlassCard>
  )
}

function GroupRow({ group, expanded, onToggle, onSettle, onDelete, role, settings }) {
  const isSettled = group.status === 'settled'
  const progress = group.target ? Math.round((group.net / group.target) * 100) : 0
  const flagged = group.expenses.filter((expense) => expense.amount > settings.expenseLimit).length

  return (
    <motion.div layout className={`glass gradient-edge overflow-hidden rounded-2xl ${isSettled ? 'border-brand-mint/25' : ''}`}>
      <button onClick={onToggle} className="grid w-full grid-cols-2 items-center gap-3 px-4 py-3.5 text-left md:grid-cols-[1.25fr_0.9fr_0.9fr_0.9fr_auto]">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-[var(--chip)] text-brand-amber">
              <Car size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{group.reg}</p>
              <p className="truncate text-[10px] text-muted">{formatDate(group.date, { day: 'numeric', month: 'short' })} · {group.trips.length} trips</p>
            </div>
          </div>
        </div>
        <div className="hidden md:block">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Gross</p>
          <p className="tabular text-[13px] font-semibold text-ink">{money(group.gross)}</p>
        </div>
        <div className="hidden md:block">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted">Expenses</p>
          <p className="tabular text-[13px] font-semibold text-brand-danger">−{money(group.expenseTotal)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted md:hidden">Net remittance</p>
          <p className="tabular text-[15px] font-semibold text-brand-mint">{money(group.net)}</p>
          <div className="mt-1 w-24 md:w-28"><Progress value={progress} accent={progress >= 100 ? 'mint' : 'amber'} /></div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
          {isSettled ? <SettledStamp /> : <StatusBadge status={group.status || 'pending'}>{group.status === 'reopened' ? 'Reopened' : 'Pending'}</StatusBadge>}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="text-muted">
            <ChevronDown size={17} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...spring, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline px-4 py-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div>
                  <p className="label mb-2 flex items-center gap-2"><Wallet size={13} /> Trip collections <span className="chip !py-0">{group.trips.length}</span></p>
                  <div className="space-y-2">
                    {group.trips.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-2 rounded-xl border border-hairline bg-[var(--chip)] px-3 py-2">
                        <Receipt size={14} className="shrink-0 text-brand-amber" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-medium text-ink">{trip.route || group.route}</p>
                          <p className="text-[10px] text-muted">{trip.rounds} rounds × {trip.passengers} pax × {money(trip.fare)}</p>
                        </div>
                        <span className="tabular text-[12px] font-semibold text-ink">{money(trip.gross)}</span>
                        {can(role, 'deleteLogs') && (
                          <button onClick={() => onDelete('trips', trip.id)} className="text-muted transition hover:text-brand-danger" title="Delete trip"><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                    {!group.trips.length && <p className="text-xs text-muted">No trips logged for this day.</p>}
                  </div>
                </div>
                <div>
                  <p className="label mb-2 flex items-center gap-2"><Fuel size={13} /> Operational expenses <span className="chip !py-0">{group.expenses.length}</span></p>
                  <div className="space-y-2">
                    {group.expenses.map((expense) => {
                      const Icon = CATEGORY_ICON[expense.category] || Receipt
                      return (
                        <div key={expense.id} className="flex items-center gap-2 rounded-xl border border-hairline bg-[var(--chip)] px-3 py-2">
                          <Icon size={14} className="shrink-0 text-brand-violet" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-ink">
                              {expense.category}
                              {expense.amount > settings.expenseLimit && <span className="ml-1.5 text-[9px] font-bold text-brand-danger">OVER LIMIT</span>}
                            </p>
                            <p className="truncate text-[10px] text-muted">{expense.note || expense.receiptNo || expense.createdBy}</p>
                          </div>
                          <span className="tabular text-[12px] font-semibold text-brand-danger">−{money(expense.amount)}</span>
                          {can(role, 'deleteLogs') && (
                            <button onClick={() => onDelete('expenses', expense.id)} className="text-muted transition hover:text-brand-danger" title="Delete expense"><Trash2 size={14} /></button>
                          )}
                        </div>
                      )
                    })}
                    {!group.expenses.length && <p className="text-xs text-muted">No expenses logged for this day.</p>}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <div className="flex flex-wrap gap-5">
                  <InlineStat label="Gross" value={money(group.gross)} />
                  <InlineStat label="Expenses" value={`−${money(group.expenseTotal)}`} />
                  <InlineStat label="Daily target" value={money(group.target)} />
                  <InlineStat label="Net owed" value={money(group.net)} accent />
                  {flagged > 0 && <span className="chip border-brand-danger/30 text-brand-danger">{flagged} over limit</span>}
                </div>
                {can(role, 'settleRemittance') ? (
                  isSettled ? (
                    <button className="btn btn-ghost" onClick={() => onSettle('reopen', group)}>
                      <RotateCcw size={14} /> Reopen
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => onSettle('settle', group)}>
                      <Check size={15} /> Settle remittance
                    </button>
                  )
                ) : (
                  <span className="chip"><LockKeyhole size={12} /> Owner approval required</span>
                )}
              </div>
              {group.reference && <p className="mt-2 text-right font-mono text-[10px] text-muted">Ref {group.reference} · {group.settledBy || '—'}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function RemittanceLedger() {
  const { role, settings, notify, confirm, actor } = useApp()
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), []) || []
  const trips = useLiveQuery(() => db.trips.toArray(), []) || []
  const expenses = useLiveQuery(() => db.expenses.toArray(), []) || []
  const remittances = useLiveQuery(() => db.remittances.toArray(), []) || []

  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [range, setRange] = useState('7')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [formOpen, setFormOpen] = useState(true)

  const today = localISO()
  const startDate = useMemo(() => {
    const preset = RANGES.find((r) => r.id === range)
    return preset?.days ? shiftISO(today, -(preset.days - 1)) : null
  }, [range, today])

  const groups = useMemo(() => {
    const map = new Map()
    const ensure = (vehicleId, date) => {
      const key = `${vehicleId}|${date}`
      if (!map.has(key)) {
        const vehicle = vehicles.find((v) => v.id === vehicleId)
        map.set(key, {
          key,
          vehicleId,
          date,
          reg: vehicle?.reg || vehicleId,
          route: vehicle?.route || '',
          trips: [],
          expenses: [],
          gross: 0,
          expenseTotal: 0,
          net: 0,
          target: settings.dailyTarget || 0,
          status: 'pending'
        })
      }
      return map.get(key)
    }

    trips.forEach((trip) => {
      if (startDate && trip.date < startDate) return
      const group = ensure(trip.vehicleId, trip.date)
      group.trips.push(trip)
      group.gross += Number(trip.gross) || 0
    })
    expenses.forEach((expense) => {
      if (startDate && expense.date < startDate) return
      const group = ensure(expense.vehicleId, expense.date)
      group.expenses.push(expense)
      group.expenseTotal += Number(expense.amount) || 0
    })
    remittances.forEach((record) => {
      const group = ensure(record.vehicleId, record.date)
      group.status = record.status
      group.reference = record.reference
      group.settledBy = record.settledBy
      group.recordId = record.id
    })

    let result = [...map.values()].map((group) => ({ ...group, net: group.gross - group.expenseTotal }))
    if (vehicleFilter !== 'all') result = result.filter((g) => g.vehicleId === vehicleFilter)
    if (status !== 'all') result = result.filter((g) => (status === 'settled' ? g.status === 'settled' : g.status !== 'settled'))
    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter((g) => [g.reg, g.route, g.reference, ...g.trips.map((t) => t.collectedBy)]
        .some((value) => String(value || '').toLowerCase().includes(term)))
    }
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.reg.localeCompare(b.reg))
  }, [trips, expenses, remittances, vehicles, settings.dailyTarget, startDate, vehicleFilter, status, search])

  const kpis = useMemo(() => {
    const gross = sum(groups, 'gross')
    const expenseTotal = sum(groups, 'expenseTotal')
    const net = gross - expenseTotal
    const target = sum(groups, 'target')
    const settled = groups.filter((g) => g.status === 'settled').reduce((total, g) => total + g.net, 0)
    return { gross, expenseTotal, net, target, settled, pending: net - settled, attainment: target ? Math.round((net / target) * 100) : 0 }
  }, [groups])

  const comparative = useMemo(() => vehicles.filter((v) => vehicleFilter === 'all' || v.id === vehicleFilter).map((vehicle) => {
    const rows = groups.filter((g) => g.vehicleId === vehicle.id)
    const gross = sum(rows, 'gross')
    const expenseTotal = sum(rows, 'expenseTotal')
    const net = gross - expenseTotal
    const target = sum(rows, 'target')
    return {
      vehicle,
      gross,
      expenseTotal,
      net,
      target,
      days: rows.length,
      settled: rows.filter((g) => g.status === 'settled').length,
      attainment: target ? Math.round((net / target) * 100) : 0,
      trend: rows.slice().sort((a, b) => a.date.localeCompare(b.date)).map((g) => g.net)
    }
  }).sort((a, b) => b.net - a.net), [vehicles, groups, vehicleFilter])

  const handleDelete = async (kind, id) => {
    const ok = await confirm({
      title: 'Delete ledger entry?',
      message: 'This permanently removes the entry and reopens any settled remittance for that day. Only the fleet owner can do this.',
      confirmLabel: 'Delete entry',
      danger: true
    })
    if (!ok) return
    try {
      await deleteLedgerEntry(kind, id, actor)
      notify('Entry removed and settlement recalculated.', 'warning')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleSettle = async (mode, group) => {
    try {
      if (mode === 'reopen') {
        const ok = await confirm({
          title: 'Reopen settlement?',
          message: `${group.reg} · ${formatDate(group.date)} will return to pending until settled again.`,
          confirmLabel: 'Reopen'
        })
        if (!ok) return
        await reopenRemittance(group.recordId, actor)
        notify('Remittance reopened for review.', 'info')
      } else {
        await settleRemittance(group.vehicleId, group.date, actor)
        setExpanded(group.key)
        notify(`${group.reg} remittance of ${money(group.net)} settled. Owner receipt generated.`)
      }
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const exportCsv = () => {
    if (!can(role, 'exportAudit')) return
    const header = ['Date', 'Vehicle', 'Route', 'Trips', 'Gross (KSh)', 'Expenses (KSh)', 'Net (KSh)', 'Target (KSh)', 'Status', 'Reference', 'Settled By']
    const lines = [header.map(csvEscape).join(',')]
    groups.forEach((g) => lines.push([
      g.date, g.reg, g.route, g.trips.length, g.gross, g.expenseTotal, g.net, g.target, g.status, g.reference || '', g.settledBy || ''
    ].map(csvEscape).join(',')))
    lines.push('')
    lines.push(['TOTAL', '', '', '', kpis.gross, kpis.expenseTotal, kpis.net, kpis.target, '', '', ''].map(csvEscape).join(','))
    downloadText(`matatupulse-audit-${today}.csv`, lines.join('\n'))
    notify('Financial audit statement exported as CSV.')
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Money trail"
        title="Trip & Daily Remittance Ledger"
        description="Round-trip collections minus fuel, stage fees and squad costs — the exact amount owed to each owner, per vehicle per day."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setFormOpen((value) => !value)}>
              {formOpen ? <X size={15} /> : <Plus size={15} />} {formOpen ? 'Hide entry form' : 'New entry'}
            </button>
            <button className="btn btn-primary" onClick={exportCsv} disabled={!can(role, 'exportAudit')} title={!can(role, 'exportAudit') ? 'Owner / Admin only' : 'Export CSV'}>
              {can(role, 'exportAudit') ? <Download size={15} /> : <LockKeyhole size={14} />} Export audit
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Gross collections" value={money(kpis.gross)} sub={`${groups.reduce((n, g) => n + g.trips.length, 0)} trip logs in view`} icon={Wallet} accent="amber" />
        <KpiCard index={1} label="Operational expenses" value={`−${money(kpis.expenseTotal)}`} sub={`${groups.reduce((n, g) => n + g.expenses.length, 0)} receipts logged`} icon={Fuel} accent="danger" />
        <KpiCard index={2} label="Net remittance owed" value={money(kpis.net)} sub={`${money(kpis.pending)} awaiting settlement`} icon={TrendingUp} accent="mint" />
        <KpiCard index={3} label="Target attainment" value={`${kpis.attainment}%`} sub={`${money(kpis.target)} daily baseline in view`} icon={BadgeCheck} accent="violet" footer={<Progress value={kpis.attainment} accent={kpis.attainment >= 100 ? 'mint' : 'violet'} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field !pl-9" placeholder="Search plate, route, collector or ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="field !w-auto min-w-[150px]" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="all">All vehicles</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.reg}</option>)}
            </select>
            <select className="field !w-auto min-w-[130px]" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <CalendarDays size={14} className="text-muted" />
            {RANGES.map((item) => (
              <button key={item.id} onClick={() => setRange(item.id)} className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${range === item.id ? 'border-brand-amber/50 bg-brand-amber/12 text-brand-amber' : 'border-hairline text-muted hover:text-ink'}`}>
                {item.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted">{groups.length} vehicle-day records</span>
          </div>

          <div className="space-y-2.5">
            {groups.length ? groups.map((group) => (
              <GroupRow
                key={group.key}
                group={group}
                expanded={expanded === group.key}
                onToggle={() => setExpanded((current) => (current === group.key ? null : group.key))}
                onSettle={handleSettle}
                onDelete={handleDelete}
                role={role}
                settings={settings}
              />
            )) : (
              <EmptyState
                icon={Receipt}
                title="No ledger rows match these filters"
                description="Log a trip collection or expense, or widen the date range to see historical records."
                action={<button className="btn btn-ghost" onClick={() => { setVehicleFilter('all'); setStatus('all'); setRange('all'); setSearch('') }}>Clear filters</button>}
              />
            )}
          </div>
        </GlassCard>

        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="min-w-0">
              <EntryForm vehicles={vehicles} settings={settings} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Comparative view</p>
            <h3 className="mt-1 text-base font-semibold text-ink">Per-vehicle performance</h3>
          </div>
          <span className="chip">Period: {startDate ? `${formatDate(startDate, { day: 'numeric', month: 'short' })} → ${formatDate(today, { day: 'numeric', month: 'short' })}` : 'All time'}</span>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-y border-hairline bg-[var(--chip)]">
                <th className="table-head px-5 py-3">Vehicle / route</th>
                <th className="table-head px-3 py-3">Gross</th>
                <th className="table-head px-3 py-3">Expenses</th>
                <th className="table-head px-3 py-3">Net</th>
                <th className="table-head px-3 py-3">Target hit</th>
                <th className="table-head px-3 py-3">Trend</th>
                <th className="table-head px-3 py-3">Settled</th>
              </tr>
            </thead>
            <tbody>
              {comparative.map((row) => (
                <tr key={row.vehicle.id} className="border-b border-hairline/70 transition hover:bg-[var(--chip)]">
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-semibold text-ink">{row.vehicle.reg}</p>
                    <p className="text-[10px] text-muted">{row.vehicle.route} · {row.days} days</p>
                  </td>
                  <td className="tabular px-3 py-3 text-[12px] text-ink">{money(row.gross)}</td>
                  <td className="tabular px-3 py-3 text-[12px] text-brand-danger">−{money(row.expenseTotal)}</td>
                  <td className="tabular px-3 py-3 text-[12px] font-semibold text-brand-mint">{money(row.net)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="tabular w-9 text-[11px] font-semibold text-ink">{row.attainment}%</span>
                      <div className="w-20"><Progress value={row.attainment} accent={row.attainment >= 100 ? 'mint' : 'amber'} /></div>
                    </div>
                  </td>
                  <td className="w-28 px-3 py-3"><Sparkline values={row.trend} color="var(--amber-solid)" className="w-24" /></td>
                  <td className="px-3 py-3"><span className="chip">{row.settled}/{row.days} days</span></td>
                </tr>
              ))}
              {!comparative.length && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">No vehicles to compare.</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
