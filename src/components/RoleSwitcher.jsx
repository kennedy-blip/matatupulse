import { motion } from 'framer-motion'
import { Check, Crown, LockKeyhole, UserRound } from 'lucide-react'
import { updateSettings } from '../db/actions'
import { useApp } from '../context/AppContext'
import { ROLES, PERMISSIONS, can } from '../lib/permissions'
import { spring, GlassCard } from './ui'

const CAPABILITIES = [
  { id: 'logTrips', label: 'Log trip collections' },
  { id: 'logExpenses', label: 'Record fuel & stage expenses' },
  { id: 'updateDispatch', label: 'Update stage dispatch times' },
  { id: 'settleRemittance', label: 'Settle remittances' },
  { id: 'manageTargets', label: 'Set daily targets & limits' },
  { id: 'manageCompliance', label: 'Manage compliance dates' },
  { id: 'deleteLogs', label: 'Delete historical logs' },
  { id: 'exportAudit', label: 'Export financial audits' }
]

export default function RoleSwitcher() {
  const { role, actor, notify } = useApp()

  const switchRole = async (next) => {
    if (next === role) return
    try {
      await updateSettings({ role: next }, actor)
      notify(`Switched to ${ROLES[next].short}. Privileges updated across the app.`, 'info')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Privilege context</p>
          <h3 className="mt-1 text-base font-semibold text-ink">Active role</h3>
          <p className="mt-1 max-w-xl text-[11px] leading-5 text-muted">{ROLES[role].description}</p>
        </div>
        <div className="flex rounded-2xl border border-hairline bg-[var(--chip)] p-1">
          {Object.values(ROLES).map((option) => {
            const active = option.id === role
            const Icon = option.id === 'owner' ? Crown : UserRound
            return (
              <button
                key={option.id}
                onClick={() => switchRole(option.id)}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                aria-pressed={active}
              >
                {active && <motion.span layoutId="role-pill" transition={spring} className="absolute inset-0 rounded-xl border border-brand-amber/40 bg-brand-amber/12" />}
                <Icon size={14} className={`relative ${active ? 'text-brand-amber' : ''}`} />
                <span className="relative hidden sm:inline">{option.short}</span>
                <span className="relative sm:hidden">{option.id === 'owner' ? 'Owner' : 'Field'}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {CAPABILITIES.map((item) => {
          const allowed = can(role, item.id)
          return (
            <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${allowed ? 'border-brand-mint/25 bg-brand-mint/[0.06]' : 'border-hairline bg-[var(--chip)]'}`}>
              {allowed ? <Check size={13} className="shrink-0 text-brand-mint" /> : <LockKeyhole size={13} className="shrink-0 text-muted" />}
              <span className={`truncate text-[10.5px] ${allowed ? 'text-ink' : 'text-muted'}`}>{item.label}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[9.5px] leading-4 text-muted">
        Role changes are local to this device and written to the audit trail. {Object.keys(PERMISSIONS).length} permission groups are enforced in the data layer, not just the UI.
      </p>
    </GlassCard>
  )
}
