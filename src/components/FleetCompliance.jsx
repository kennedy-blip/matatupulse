import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Fuel,
  Gauge,
  LockKeyhole,
  PencilLine,
  Search,
  ShieldCheck,
  Wrench
} from 'lucide-react'
import { db } from '../db/db'
import { logVehicleService, updateComplianceRecord } from '../db/actions'
import { useApp } from '../context/AppContext'
import { can } from '../lib/permissions'
import { daysUntil, formatDate, localISO, relativeDays } from '../lib/format'
import { spring, GlassCard, SectionHeading, KpiCard, Progress, StatusBadge, EmptyState, Modal } from './ui'

function severityOf(oilRemaining, ntsaDays, insuranceDays) {
  if (oilRemaining <= 0 || (ntsaDays !== null && ntsaDays < 0) || (insuranceDays !== null && insuranceDays < 0)) return 'critical'
  if (oilRemaining <= 1500 || (ntsaDays !== null && ntsaDays <= 30) || (insuranceDays !== null && insuranceDays <= 30)) return 'warning'
  return 'healthy'
}

const SEVERITY = {
  critical: { label: 'Action needed', status: 'delayed', color: 'var(--danger)', icon: AlertTriangle },
  warning: { label: 'Soon due', status: 'pending', color: 'var(--amber-solid)', icon: CalendarClock },
  healthy: { label: 'Compliant', status: 'settled', color: 'var(--positive)', icon: ShieldCheck }
}

function HealthRing({ score, color }) {
  const radius = 27
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--chip)" strokeWidth="5" />
        <motion.circle
          cx="34" cy="34" r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - Math.max(0, Math.min(100, score)) / 100) }}
          transition={{ ...spring, duration: 0.9 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular text-[13px] font-bold text-ink">{Math.round(score)}</span>
      </div>
    </div>
  )
}

function ComplianceCard({ vehicle, record, onEdit, onService, role }) {
  const mileage = Number(record?.mileage) || 0
  const lastServiceKm = Number(record?.lastServiceKm) || 0
  const interval = Number(record?.oilChangeIntervalKm) || 8000
  const nextService = lastServiceKm + interval
  const oilRemaining = nextService - mileage
  const oilProgress = Math.max(0, Math.min(100, ((mileage - lastServiceKm) / interval) * 100))
  const ntsaDays = record?.ntsaExpiry ? daysUntil(record.ntsaExpiry) : null
  const insuranceDays = record?.insuranceExpiry ? daysUntil(record.insuranceExpiry) : null
  const severity = severityOf(oilRemaining, ntsaDays, insuranceDays)
  const meta = SEVERITY[severity]
  const score = Math.max(0, Math.min(100,
    100 - (oilRemaining <= 0 ? 45 : oilRemaining < 1500 ? 18 : 0)
    - (ntsaDays === null ? 0 : ntsaDays < 0 ? 30 : ntsaDays <= 30 ? 12 : 0)
    - (insuranceDays === null ? 0 : insuranceDays < 0 ? 30 : insuranceDays <= 30 ? 12 : 0)
  ))

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="glass gradient-edge flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <HealthRing score={score} color={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-ink">{vehicle.reg}</p>
            <StatusBadge status={meta.status}>{meta.label}</StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">{vehicle.route}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted"><Gauge size={12} /> {mileage.toLocaleString('en-KE')} km logged</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-muted"><Fuel size={12} /> Oil change</span>
            <span className={`tabular font-bold ${oilRemaining <= 0 ? 'text-brand-danger' : oilRemaining <= 1500 ? 'text-brand-amber' : 'text-brand-mint'}`}>
              {oilRemaining <= 0 ? `${Math.abs(oilRemaining).toLocaleString('en-KE')} km overdue` : `${oilRemaining.toLocaleString('en-KE')} km left`}
            </span>
          </div>
          <Progress value={oilProgress} accent={severity === 'healthy' ? 'mint' : severity === 'warning' ? 'amber' : 'danger'} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl border border-hairline p-2.5 ${ntsaDays !== null && ntsaDays <= 0 ? 'border-brand-danger/40' : ''}`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted">NTSA inspection</p>
            <p className="tabular mt-1 text-[12px] font-semibold text-ink">{record?.ntsaExpiry ? formatDate(record.ntsaExpiry, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
            <p className={`mt-0.5 text-[10px] ${ntsaDays !== null && ntsaDays <= 0 ? 'text-brand-danger' : 'text-muted'}`}>{relativeDays(record?.ntsaExpiry)}</p>
          </div>
          <div className={`rounded-xl border border-hairline p-2.5 ${insuranceDays !== null && insuranceDays <= 0 ? 'border-brand-danger/40' : ''}`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted">PSV insurance</p>
            <p className="tabular mt-1 text-[12px] font-semibold text-ink">{record?.insuranceExpiry ? formatDate(record.insuranceExpiry, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
            <p className={`mt-0.5 text-[10px] ${insuranceDays !== null && insuranceDays <= 0 ? 'text-brand-danger' : 'text-muted'}`}>{relativeDays(record?.insuranceExpiry)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
        <p className="text-[10px] text-muted">Last service {record?.lastServiceDate ? formatDate(record.lastServiceDate, { day: 'numeric', month: 'short' }) : '—'}</p>
        {can(role, 'manageCompliance') ? (
          <div className="flex gap-1.5">
            <button className="btn btn-ghost !px-2 !py-1.5 !text-[10px]" onClick={() => onService(vehicle.id)}><Wrench size={12} /> Log service</button>
            <button className="btn btn-ghost !px-2 !py-1.5 !text-[10px]" onClick={() => onEdit(vehicle.id)}><PencilLine size={12} /> Edit</button>
          </div>
        ) : (
          <span className="chip"><LockKeyhole size={11} /> Owner only</span>
        )}
      </div>
    </motion.div>
  )
}

function ComplianceEditor({ open, onClose, vehicleId, record, onSave, role }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const existing = useMemo(() => ({
    mileage: record?.mileage ?? 0,
    lastServiceKm: record?.lastServiceKm ?? 0,
    oilChangeIntervalKm: record?.oilChangeIntervalKm ?? 8000,
    lastServiceDate: record?.lastServiceDate ?? localISO(),
    ntsaExpiry: record?.ntsaExpiry ?? '',
    insuranceExpiry: record?.insuranceExpiry ?? ''
  }), [record])

  const active = form || existing
  const update = (key, value) => setForm({ ...active, [key]: value })

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(vehicleId, active)
      setForm(null)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => { setForm(null); onClose() }} title={`Compliance record · ${vehicleId}`} subtitle="Owner-only controls. Changes are saved locally and written to the audit trail." width="max-w-lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Current mileage (km)</label>
            <input className="field tabular" type="number" min="0" value={active.mileage} onChange={(e) => update('mileage', e.target.value)} required />
          </div>
          <div>
            <label className="label">Last service (km)</label>
            <input className="field tabular" type="number" min="0" value={active.lastServiceKm} onChange={(e) => update('lastServiceKm', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Oil interval (km)</label>
            <input className="field tabular" type="number" min="500" value={active.oilChangeIntervalKm} onChange={(e) => update('oilChangeIntervalKm', e.target.value)} required />
          </div>
          <div>
            <label className="label">Last service date</label>
            <input className="field" type="date" value={active.lastServiceDate} onChange={(e) => update('lastServiceDate', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">NTSA expiry</label>
            <input className="field" type="date" value={active.ntsaExpiry} onChange={(e) => update('ntsaExpiry', e.target.value)} required />
          </div>
          <div>
            <label className="label">PSV insurance expiry</label>
            <input className="field" type="date" value={active.insuranceExpiry} onChange={(e) => update('insuranceExpiry', e.target.value)} required />
          </div>
        </div>
        <button className="btn btn-primary w-full" type="submit" disabled={saving || !can(role, 'manageCompliance')}>
          {saving ? 'Saving…' : 'Save compliance record'}
        </button>
      </form>
    </Modal>
  )
}

export default function FleetCompliance() {
  const { role, actor, notify } = useApp()
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), []) || []
  const compliance = useLiveQuery(() => db.compliance.toArray(), []) || []
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)

  const enriched = useMemo(() => vehicles.map((vehicle) => {
    const record = compliance.find((c) => c.vehicleId === vehicle.id || c.id === vehicle.id) || null
    const mileage = Number(record?.mileage) || 0
    const lastServiceKm = Number(record?.lastServiceKm) || 0
    const interval = Number(record?.oilChangeIntervalKm) || 8000
    const oilRemaining = lastServiceKm + interval - mileage
    const ntsaDays = record?.ntsaExpiry ? daysUntil(record.ntsaExpiry) : null
    const insuranceDays = record?.insuranceExpiry ? daysUntil(record.insuranceExpiry) : null
    return { vehicle, record, severity: severityOf(oilRemaining, ntsaDays, insuranceDays), oilRemaining, ntsaDays, insuranceDays }
  }), [vehicles, compliance])

  const shown = enriched.filter((item) => {
    const matchFilter = filter === 'all' || item.severity === filter
    const term = search.trim().toLowerCase()
    const matchSearch = !term || `${item.vehicle.reg} ${item.vehicle.route} ${item.vehicle.driver}`.toLowerCase().includes(term)
    return matchFilter && matchSearch
  })
  const attention = enriched.filter((item) => item.severity !== 'healthy')
  const critical = enriched.filter((item) => item.severity === 'critical').length
  const score = enriched.length ? Math.round(enriched.reduce((total, item) => total + (item.severity === 'healthy' ? 100 : item.severity === 'warning' ? 68 : 35), 0) / enriched.length) : 0

  const alerts = useMemo(() => enriched.flatMap((item) => {
    const list = []
    if (item.oilRemaining <= 0) list.push({ id: `${item.vehicle.id}-oil`, severity: 'critical', icon: Fuel, title: `${item.vehicle.reg} oil service overdue`, detail: `${Math.abs(item.oilRemaining).toLocaleString('en-KE')} km past the ${(Number(item.record?.oilChangeIntervalKm) || 8000).toLocaleString('en-KE')} km interval.` })
    else if (item.oilRemaining <= 1500) list.push({ id: `${item.vehicle.id}-oil`, severity: 'warning', icon: Fuel, title: `${item.vehicle.reg} oil change approaching`, detail: `${item.oilRemaining.toLocaleString('en-KE')} km before next service.` })
    if (item.ntsaDays !== null && item.ntsaDays <= 30) list.push({ id: `${item.vehicle.id}-ntsa`, severity: item.ntsaDays < 0 ? 'critical' : 'warning', icon: ClipboardCheck, title: `${item.vehicle.reg} NTSA inspection`, detail: relativeDays(item.record.ntsaExpiry) })
    if (item.insuranceDays !== null && item.insuranceDays <= 30) list.push({ id: `${item.vehicle.id}-ins`, severity: item.insuranceDays < 0 ? 'critical' : 'warning', icon: ShieldCheck, title: `${item.vehicle.reg} PSV insurance`, detail: relativeDays(item.record.insuranceExpiry) })
    return list
  }).sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1)), [enriched])

  const saveRecord = async (vehicleId, form) => {
    try {
      await updateComplianceRecord(vehicleId, form, actor)
      notify(`${vehicleId} compliance record updated.`)
    } catch (error) {
      notify(error.message, 'error')
      throw error
    }
  }

  const service = async (vehicleId) => {
    try {
      await logVehicleService(vehicleId, actor)
      notify(`Service logged for ${vehicleId}. Oil countdown reset to current mileage.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const editing = enriched.find((item) => item.vehicle.id === editingId)

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Asset reliability"
        title="Fleet Compliance & Service Tracker"
        description="Mileage, oil-change countdowns, NTSA inspection renewals and PSV insurance expiries with automatic warnings."
        action={!can(role, 'manageCompliance') ? <span className="chip"><LockKeyhole size={12} /> Field view · owner can edit records</span> : <span className="chip text-brand-mint"><ShieldCheck size={12} /> Full compliance control</span>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Vehicles tracked" value={enriched.length} sub="Active PSV records in the fleet" icon={Car} accent="violet" />
        <KpiCard index={1} label="Needs attention" value={attention.length} sub={`${critical} critical item${critical === 1 ? '' : 's'}`} icon={AlertTriangle} accent={critical ? 'danger' : 'amber'} />
        <KpiCard index={2} label="Open warnings" value={alerts.length} sub="Service and document deadlines" icon={CalendarClock} accent="amber" />
        <KpiCard index={3} label="Fleet health score" value={`${score}%`} sub="Weighted across all vehicles" icon={Activity} accent={score >= 80 ? 'mint' : 'danger'} footer={<Progress value={score} accent={score >= 80 ? 'mint' : 'danger'} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <GlassCard className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="field !pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration, route or driver…" />
              </div>
              {[
                { id: 'all', label: 'All' },
                { id: 'healthy', label: 'Healthy' },
                { id: 'warning', label: 'Soon due' },
                { id: 'critical', label: 'Critical' }
              ].map((item) => (
                <button key={item.id} onClick={() => setFilter(item.id)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${filter === item.id ? 'border-brand-amber/50 bg-brand-amber/12 text-brand-amber' : 'border-hairline text-muted hover:text-ink'}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {shown.map((item) => (
                  <ComplianceCard
                    key={item.vehicle.id}
                    vehicle={item.vehicle}
                    record={item.record}
                    role={role}
                    onEdit={setEditingId}
                    onService={service}
                  />
                ))}
              </AnimatePresence>
            </div>
            {!shown.length && <EmptyState icon={ShieldCheck} title="No vehicles match this filter" description="Try a different status filter or clear your search." action={<button className="btn btn-ghost" onClick={() => { setFilter('all'); setSearch('') }}>Clear filters</button>} />}
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Fleet matrix</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">Comparative compliance dates</h3>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-y border-hairline bg-[var(--chip)]">
                    <th className="table-head px-5 py-2.5">Vehicle</th>
                    <th className="table-head px-3 py-2.5">Mileage</th>
                    <th className="table-head px-3 py-2.5">Oil due</th>
                    <th className="table-head px-3 py-2.5">NTSA</th>
                    <th className="table-head px-3 py-2.5">Insurance</th>
                    <th className="table-head px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((item) => (
                    <tr key={item.vehicle.id} className="border-b border-hairline/60 text-[11px]">
                      <td className="px-5 py-2.5 font-semibold text-ink">{item.vehicle.reg}</td>
                      <td className="tabular px-3 py-2.5 text-muted">{(Number(item.record?.mileage) || 0).toLocaleString('en-KE')} km</td>
                      <td className={`tabular px-3 py-2.5 ${item.oilRemaining <= 0 ? 'text-brand-danger' : 'text-muted'}`}>{item.oilRemaining.toLocaleString('en-KE')} km</td>
                      <td className="px-3 py-2.5 text-muted">{item.record?.ntsaExpiry ? formatDate(item.record.ntsaExpiry) : '—'}</td>
                      <td className="px-3 py-2.5 text-muted">{item.record?.insuranceExpiry ? formatDate(item.record.insuranceExpiry) : '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={SEVERITY[item.severity].status}>{SEVERITY[item.severity].label}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <GlassCard className="h-fit p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Automated alerts</p>
              <h3 className="mt-1 text-sm font-semibold text-ink">Action queue</h3>
            </div>
            <span className="chip">{alerts.length} alerts</span>
          </div>
          <div className="space-y-2.5">
            {alerts.map((alert) => {
              const Icon = alert.icon
              return (
                <div key={alert.id} className={`rounded-xl border p-3 ${alert.severity === 'critical' ? 'border-brand-danger/35 bg-brand-danger/[0.08]' : 'border-brand-amber/30 bg-brand-amber/[0.07]'}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-brand-danger' : 'text-brand-amber'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-ink">{alert.title}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-muted">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {!alerts.length && (
              <div className="rounded-xl border border-brand-mint/30 bg-brand-mint/[0.07] p-4 text-center">
                <CheckCircle2 size={24} className="mx-auto text-brand-mint" />
                <p className="mt-2 text-xs font-semibold text-ink">All vehicles compliant</p>
                <p className="mt-1 text-[10px] text-muted">No service or document deadlines in the next 30 days.</p>
              </div>
            )}
          </div>
          {can(role, 'manageCompliance') && <div className="divider my-4" />}
          {can(role, 'manageCompliance') && (
            <div className="rounded-xl border border-hairline bg-[var(--chip)] p-3">
              <p className="text-[11px] font-semibold text-ink">Owner workflow</p>
              <p className="mt-1 text-[10px] leading-4 text-muted">Update mileage and expiry dates, then use “Log service” after every oil change to reset the countdown automatically.</p>
              <div className="mt-2 flex gap-3 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1"><Wrench size={11} /> Service reset</span>
                <span className="inline-flex items-center gap-1"><ClipboardCheck size={11} /> Audit logged</span>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      <ComplianceEditor open={Boolean(editingId)} onClose={() => setEditingId(null)} vehicleId={editingId} record={editing?.record} onSave={saveRecord} role={role} />
    </div>
  )
}
