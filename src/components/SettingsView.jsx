import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import {
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  Wifi,
  WifiOff
} from 'lucide-react'
import { db, resetWorkspace, workspaceStats } from '../db/db'
import { buildBackup, restoreBackup, updateSettings, writeAudit } from '../db/actions'
import { useApp } from '../context/AppContext'
import { can } from '../lib/permissions'
import { csvEscape, downloadText, formatTime, money } from '../lib/format'
import { spring, GlassCard, SectionHeading, KpiCard, Progress, StatusBadge } from './ui'
import RoleSwitcher from './RoleSwitcher'
import ThemeToggle from './ThemeToggle'
import DownloadAPKModal from './DownloadAPKModal'

const NUMBER_FIELDS = [
  { key: 'dailyTarget', label: 'Daily net remittance target (KSh)', hint: 'Baseline used for target attainment across every vehicle-day.' },
  { key: 'expenseLimit', label: 'Single expense alert limit (KSh)', hint: 'Receipts above this amount are flagged in the audit view.' },
  { key: 'dispatchIntervalMin', label: 'Dispatch interval (minutes)', hint: 'Vehicles waiting longer are flagged as delayed automatically.' }
]

export default function SettingsView() {
  const { settings, role, actor, online, notify, confirm } = useApp()
  const auditRows = useLiveQuery(() => db.audit.orderBy('at').reverse().limit(30).toArray(), [])
  const [stats, setStats] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const refreshStats = () => workspaceStats().then(setStats).catch(() => setStats(null))

  useEffect(() => {
    refreshStats()
    const timer = window.setInterval(refreshStats, 20000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setDraft({
      dailyTarget: settings.dailyTarget,
      expenseLimit: settings.expenseLimit,
      dispatchIntervalMin: settings.dispatchIntervalMin,
      stage: settings.stage,
      ownerName: settings.ownerName,
      operatorName: settings.operatorName
    })
  }, [settings.dailyTarget, settings.expenseLimit, settings.dispatchIntervalMin, settings.stage, settings.ownerName, settings.operatorName])

  const isAdmin = can(role, 'manageTargets')
  const usagePercent = stats?.quota ? Math.round(((stats.usage || 0) / stats.quota) * 100) : 0

  const saveBaselines = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await updateSettings({
        dailyTarget: Math.max(1, Number(draft.dailyTarget) || 0),
        expenseLimit: Math.max(1, Number(draft.expenseLimit) || 0),
        dispatchIntervalMin: Math.max(1, Number(draft.dispatchIntervalMin) || 0),
        stage: String(draft.stage || '').trim(),
        ownerName: String(draft.ownerName || '').trim(),
        operatorName: String(draft.operatorName || '').trim()
      }, actor)
      notify('Operational baselines saved. New calculations use these values immediately.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const exportBackup = async () => {
    try {
      const rows = await Promise.all(db.tables.map(async (table) => ({ name: table.name, rows: await table.toArray() })))
      const backup = buildBackup(rows, settings)
      downloadText(`matatupulse-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json')
      await writeAudit(actor, 'Backup exported', `${stats?.total || 0} records`)
      notify('Full offline backup downloaded as JSON.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const ok = await confirm({
      title: 'Restore this backup?',
      message: 'All current vehicles, ledger entries, dispatch records and compliance data on this device will be replaced by the backup contents.',
      confirmLabel: 'Restore backup',
      danger: true
    })
    if (!ok) return
    try {
      const payload = JSON.parse(await file.text())
      await restoreBackup(payload, actor)
      await refreshStats()
      notify('Backup restored. All modules are showing the imported data.', 'success')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const resetData = async () => {
    const ok = await confirm({
      title: 'Reset the workspace?',
      message: 'Every log, settlement, queue entry and compliance record will be cleared and replaced with the original demo fleet. This cannot be undone unless you have exported a backup.',
      confirmLabel: 'Reset workspace',
      danger: true
    })
    if (!ok) return
    await resetWorkspace()
    await refreshStats()
    notify('Workspace reset to the demo fleet.', 'warning')
  }

  const exportAuditLog = () => {
    if (!can(role, 'exportAudit')) return
    const lines = [['Timestamp', 'Actor', 'Role', 'Action', 'Detail'].map(csvEscape).join(',')]
    ;(auditRows || []).slice().reverse().forEach((row) => lines.push([
      new Date(row.at).toISOString(), row.actor, row.role, row.action, row.detail
    ].map(csvEscape).join(',')))
    downloadText(`matatupulse-activity-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
    notify('Activity log exported.')
  }

  const updateConnection = async () => {
    if (!navigator.serviceWorker) {
      notify('Service workers are not supported by this browser; the local database still works.', 'info')
      return
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        notify('Offline cache is not registered yet. Open the app once over HTTPS to enable it.', 'warning')
        return
      }
      await registration.update()
      notify('Offline cache checked. You are running the latest cached shell.', 'success')
    } catch {
      notify('Could not check for an update right now.', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Control room"
        title="Settings & APK Center"
        description="Privileges, stage baselines, appearance, offline storage and the Android build pipeline — all in one place."
        action={<span className="chip"><Settings2 size={12} /> MatatuPulse v1.0.0</span>}
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <RoleSwitcher />
        <ThemeToggle />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassCard className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-amber/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Dual deployment</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">Android APK Center</h3>
              <p className="mt-2 text-[12px] leading-5 text-muted">The same offline-first web build is wrapped with Capacitor and packaged for Android. Download the published binary or build it in one command.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-amber/30 bg-brand-amber/10 text-brand-amber"><Smartphone size={22} /></div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2">
            <DownloadAPKModal className="!px-5 !py-3" />
            <button className="btn btn-ghost !py-3" onClick={updateConnection}><RefreshCw size={15} /> Check offline cache</button>
          </div>
          <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
            {[
              { icon: WifiOff, title: '100% offline', detail: 'IndexedDB ledger' },
              { icon: Smartphone, title: 'Capacitor', detail: 'Android wrapper' },
              { icon: ShieldCheck, title: 'Role-gated', detail: 'Field & owner modes' }
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-xl border border-hairline bg-[var(--chip)] p-3">
                  <Icon size={15} className="text-brand-violet" />
                  <p className="mt-2 text-[11px] font-semibold text-ink">{item.title}</p>
                  <p className="text-[10px] text-muted">{item.detail}</p>
                </div>
              )
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Financial baselines</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Operational settings</h3>
            </div>
            {isAdmin ? <StatusBadge status="settled">Editable</StatusBadge> : <StatusBadge status="pending">Read only</StatusBadge>}
          </div>
          <form onSubmit={saveBaselines} className="mt-4 space-y-3">
            {NUMBER_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                <input
                  className="field tabular"
                  type="number"
                  min="1"
                  value={draft[field.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                  disabled={!isAdmin}
                />
                <p className="mt-1 text-[10px] text-muted">{field.hint}</p>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Home stage</label>
                <input className="field" value={draft.stage ?? ''} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} disabled={!isAdmin} />
              </div>
              <div>
                <label className="label">Owner / SACCO name</label>
                <input className="field" value={draft.ownerName ?? ''} onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })} disabled={!isAdmin} />
              </div>
            </div>
            <div>
              <label className="label">Active field operator</label>
              <input className="field" value={draft.operatorName ?? ''} onChange={(e) => setDraft({ ...draft, operatorName: e.target.value })} disabled={!isAdmin} />
              <p className="mt-1 text-[10px] text-muted">Appears as the collector on new trip logs and as the actor in the audit trail.</p>
            </div>
            {isAdmin ? (
              <button className="btn btn-primary w-full" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Save size={15} /> Save settings</>}</button>
            ) : (
              <div className="rounded-xl border border-hairline bg-[var(--chip)] px-3 py-2.5 text-[11px] text-muted">
                Field staff can log money and dispatch events, but cannot change target baselines, expense limits or the operator identity.
              </div>
            )}
          </form>
        </GlassCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Offline records" value={stats?.total ?? '—'} sub="Across 7 local tables" icon={Database} accent="violet" />
        <KpiCard index={1} label="Trip logs" value={stats?.records.trips ?? '—'} sub="Round-trip collections" icon={ArchiveRestore} accent="amber" />
        <KpiCard index={2} label="Local storage used" value={stats?.usage ? `${(stats.usage / 1024 / 1024).toFixed(2)} MB` : '—'} sub={stats?.quota ? `${usagePercent}% of available quota` : 'Estimate unavailable'} icon={HardDrive} accent="mint" footer={stats?.quota ? <Progress value={usagePercent} accent="mint" /> : undefined} />
        <KpiCard index={3} label="Connection" value={online ? 'Online' : 'Offline'} sub={online ? 'GitHub APK lookup available' : 'All local features still active'} icon={online ? Wifi : WifiOff} accent={online ? 'mint' : 'amber'} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Local data</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Backup & storage</h3>
            </div>
            <button className="btn btn-ghost !py-2" onClick={refreshStats}><RefreshCw size={14} /> Refresh stats</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(stats?.records || {}).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-hairline bg-[var(--chip)] p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted">{key}</p>
                <p className="tabular mt-1 text-lg font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={exportBackup} disabled={!can(role, 'manageBackups')}><FileJson size={14} /> Export JSON backup</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!can(role, 'manageBackups')}><Upload size={14} /> Restore backup</button>
            <button className="btn btn-ghost text-brand-danger" onClick={resetData} disabled={!can(role, 'manageBackups')}><Trash2 size={14} /> Reset demo data</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
          </div>
          <p className="mt-3 text-[10px] leading-4 text-muted">Exports include every table and all settings. Restoring replaces local data — export first if you want to keep it.</p>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Traceability</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Activity trail</h3>
            </div>
            <button className="btn btn-ghost !py-2" onClick={exportAuditLog} disabled={!can(role, 'exportAudit')}><FileSpreadsheet size={14} /> Export log</button>
          </div>
          {isAdmin ? (
            <div className="scroll-thin mt-4 max-h-[330px] space-y-2 overflow-y-auto pr-1">
              {(auditRows || []).map((row) => (
                <motion.div key={row.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, duration: 0.25 }} className="flex items-start gap-2.5 rounded-xl border border-hairline bg-[var(--chip)] p-2.5">
                  <History size={14} className="mt-0.5 shrink-0 text-brand-violet" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-ink">{row.action}</p>
                    <p className="truncate text-[10px] text-muted">{row.detail || '—'}</p>
                    <p className="mt-0.5 text-[9px] text-muted">{row.actor} · {row.role} · {formatTime(row.at)}</p>
                  </div>
                </motion.div>
              ))}
              {!auditRows?.length && <div className="rounded-xl border border-dashed border-hairline p-6 text-center text-xs text-muted">No activity yet.</div>}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-hairline bg-[var(--chip)] p-4">
              <CheckCircle2 size={20} className="text-brand-amber" />
              <p className="text-[11px] leading-5 text-muted">Your field actions are recorded in the audit trail, but reviewing and exporting the full trail is an owner-only privilege.</p>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet"><Download size={18} /></div>
          <div>
            <p className="text-[13px] font-semibold text-ink">Ready to take the fleet offline?</p>
            <p className="text-[11px] text-muted">Install the PWA from your browser menu, or use the Android APK above. Both run the same local database.</p>
          </div>
        </div>
        <DownloadAPKModal />
      </GlassCard>
    </div>
  )
}
