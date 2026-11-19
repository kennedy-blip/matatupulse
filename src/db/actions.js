import { db, ensureSettings, putSetting } from './db'
import { assertCan, can } from '../lib/permissions'
import { localISO, plateSlug } from '../lib/format'

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

export async function writeAudit(actor, action, detail = '') {
  await db.audit.add({
    at: Date.now(),
    actor: actor?.name || 'Unknown user',
    role: actor?.role || 'field',
    action,
    detail
  })
}

export async function addTrip(input, actor) {
  assertCan(actor.role, 'logTrips')
  const rounds = Math.max(1, Math.floor(Number(input.rounds) || 1))
  const passengers = Math.max(1, Math.floor(Number(input.passengers) || 0))
  const fare = Math.max(1, Math.round(Number(input.fare) || 0))
  const date = input.date || localISO()
  const vehicleId = input.vehicleId
  if (!vehicleId) throw new Error('Choose a vehicle before saving a trip.')

  const trip = {
    vehicleId,
    date,
    route: String(input.route || '').trim(),
    rounds,
    passengers,
    fare,
    gross: rounds * passengers * fare,
    collectedBy: actor.name,
    note: String(input.note || '').trim(),
    createdAt: Date.now()
  }
  const id = await db.trips.add(trip)
  await writeAudit(actor, 'Trip collection logged', `${trip.route} · ${rounds} rounds · KSh ${trip.gross.toLocaleString('en-KE')}`)
  return id
}

export async function addExpense(input, actor) {
  assertCan(actor.role, 'logExpenses')
  const amount = Math.round(Number(input.amount) || 0)
  if (amount <= 0) throw new Error('Enter an expense amount greater than zero.')
  const expense = {
    vehicleId: input.vehicleId,
    date: input.date || localISO(),
    category: input.category,
    amount,
    note: String(input.note || '').trim(),
    receiptNo: String(input.receiptNo || '').trim().toUpperCase(),
    createdBy: actor.name,
    createdAt: Date.now()
  }
  if (!expense.vehicleId) throw new Error('Choose a vehicle before saving an expense.')
  const id = await db.expenses.add(expense)
  await writeAudit(actor, 'Expense recorded', `${expense.category} · KSh ${amount.toLocaleString('en-KE')}`)
  return id
}

export async function deleteLedgerEntry(kind, id, actor) {
  assertCan(actor.role, 'deleteLogs')
  if (kind !== 'trips' && kind !== 'expenses') throw new Error('Unknown ledger entry type.')
  const entry = await db[kind].get(id)
  if (!entry) throw new Error('Entry no longer exists.')
  await db[kind].delete(id)

  // A settled day must be reopened when its underlying figures change.
  const settlement = await db.remittances.where('[vehicleId+date]').equals([entry.vehicleId, entry.date]).first()
  if (settlement?.status === 'settled') {
    await db.remittances.put({
      ...settlement,
      status: 'reopened',
      settledAt: null,
      settledBy: null,
      updatedAt: Date.now()
    })
    await writeAudit(actor, 'Settlement reopened', `${entry.vehicleId} · ${entry.date} after ledger correction`)
  }
  await writeAudit(actor, 'Ledger entry deleted', `${kind === 'trips' ? 'Trip' : 'Expense'} · ${entry.vehicleId} · ${entry.date}`)
}

export async function getDayTotals(vehicleId, date) {
  const [trips, expenses, settings] = await Promise.all([
    db.trips.where('[vehicleId+date]').equals([vehicleId, date]).toArray(),
    db.expenses.where('[vehicleId+date]').equals([vehicleId, date]).toArray(),
    ensureSettings()
  ])
  const gross = sum(trips, 'gross')
  const expenseTotal = sum(expenses, 'amount')
  return {
    vehicleId,
    date,
    trips,
    expenses,
    gross,
    expenseTotal,
    net: gross - expenseTotal,
    target: settings.dailyTarget
  }
}

export async function settleRemittance(vehicleId, date, actor) {
  assertCan(actor.role, 'settleRemittance')
  const totals = await getDayTotals(vehicleId, date)
  if (!totals.trips.length) throw new Error('No collections logged for this vehicle and date yet.')
  const vehicle = await db.vehicles.get(vehicleId)
  const existing = await db.remittances.where('[vehicleId+date]').equals([vehicleId, date]).first()
  const reference = `MP-${date.replace(/-/g, '')}-${plateSlug(vehicle?.reg || vehicleId).slice(-5)}`
  const record = {
    ...(existing || {}),
    vehicleId,
    date,
    gross: totals.gross,
    expenseTotal: totals.expenseTotal,
    net: totals.net,
    target: totals.target,
    status: 'settled',
    reference,
    settledBy: actor.name,
    settledAt: Date.now(),
    updatedAt: Date.now(),
    createdAt: existing?.createdAt || Date.now()
  }
  await db.remittances.put(record)
  await writeAudit(actor, 'Remittance settled', `${vehicle?.reg || vehicleId} · ${date} · KSh ${totals.net.toLocaleString('en-KE')}`)
  return record
}

export async function reopenRemittance(id, actor) {
  assertCan(actor.role, 'settleRemittance')
  const record = await db.remittances.get(id)
  if (!record) throw new Error('Remittance record not found.')
  await db.remittances.put({ ...record, status: 'pending', settledAt: null, settledBy: null, updatedAt: Date.now() })
  await writeAudit(actor, 'Remittance reopened', `${record.vehicleId} · ${record.date}`)
}

export async function addDispatchEntry(input, actor) {
  assertCan(actor.role, 'updateDispatch')
  if (!input.vehicleId) throw new Error('Choose a vehicle to add to the queue.')
  const entry = {
    vehicleId: input.vehicleId,
    stage: input.stage,
    route: String(input.route || '').trim(),
    status: 'queued',
    notes: String(input.notes || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    updatedBy: actor.name
  }
  const id = await db.dispatch.add(entry)
  await writeAudit(actor, 'Vehicle joined dispatch queue', `${input.vehicleId} · ${input.stage}`)
  return id
}

const FIELD_DISPATCH_KEYS = ['status', 'notes', 'calledAt', 'boardedAt', 'departedAt', 'updatedAt', 'updatedBy']

export async function updateDispatchEntry(id, patch, actor) {
  assertCan(actor.role, 'updateDispatch')
  const entry = await db.dispatch.get(id)
  if (!entry) throw new Error('Dispatch entry not found.')
  const safePatch = { ...patch }
  if (!can(actor.role, 'manageQueue')) {
    Object.keys(safePatch).forEach((key) => {
      if (!FIELD_DISPATCH_KEYS.includes(key)) delete safePatch[key]
    })
  }
  const next = { ...entry, ...safePatch, updatedAt: Date.now(), updatedBy: actor.name }
  if (safePatch.status === 'boarding' && !next.calledAt) next.calledAt = Date.now()
  if (safePatch.status === 'departed' && !next.departedAt) {
    next.departedAt = Date.now()
    const started = next.calledAt || entry.createdAt
    next.turnaroundMinutes = Math.max(1, Math.round((next.departedAt - started) / 60000))
  }
  await db.dispatch.put(next)
  await writeAudit(actor, 'Dispatch status updated', `${entry.vehicleId} → ${next.status}`)
  return next
}

export async function deleteDispatchEntry(id, actor) {
  assertCan(actor.role, 'manageQueue')
  const entry = await db.dispatch.get(id)
  if (!entry) throw new Error('Dispatch entry not found.')
  await db.dispatch.delete(id)
  await writeAudit(actor, 'Dispatch entry removed', `${entry.vehicleId} · ${entry.stage}`)
}

export async function updateComplianceRecord(vehicleId, patch, actor) {
  assertCan(actor.role, 'manageCompliance')
  const existing = await db.compliance.get(vehicleId)
  const allowed = ['mileage', 'lastServiceKm', 'oilChangeIntervalKm', 'lastServiceDate', 'ntsaExpiry', 'insuranceExpiry']
  const clean = {}
  allowed.forEach((key) => {
    if (patch[key] === undefined || patch[key] === '') return
    clean[key] = ['mileage', 'lastServiceKm', 'oilChangeIntervalKm'].includes(key)
      ? Math.max(0, Math.round(Number(patch[key]) || 0))
      : patch[key]
  })
  const record = {
    id: vehicleId,
    vehicleId,
    ...(existing || {}),
    ...clean,
    updatedAt: Date.now()
  }
  await db.compliance.put(record)
  await writeAudit(actor, 'Compliance record updated', `${vehicleId} · ${Object.keys(clean).join(', ') || 'no changes'}`)
  return record
}

export async function logVehicleService(vehicleId, actor) {
  assertCan(actor.role, 'manageCompliance')
  const record = await db.compliance.get(vehicleId)
  if (!record) throw new Error('No compliance record for this vehicle.')
  const today = localISO()
  await db.compliance.put({
    ...record,
    lastServiceKm: record.mileage,
    lastServiceDate: today,
    updatedAt: Date.now()
  })
  await writeAudit(actor, 'Service logged', `${vehicleId} at ${record.mileage.toLocaleString('en-KE')} km`)
}

const SETTING_PERMISSION = {
  theme: null,
  role: null,
  dailyTarget: 'manageTargets',
  expenseLimit: 'manageTargets',
  dispatchIntervalMin: 'manageQueue',
  stage: 'manageQueue',
  ownerName: 'manageTargets',
  operatorName: 'manageTargets'
}

export async function updateSettings(patch, actor) {
  const writes = []
  Object.entries(patch).forEach(([key, value]) => {
    const required = SETTING_PERMISSION[key]
    if (required && !can(actor.role, required)) {
      throw new Error(`Your role cannot change ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}.`)
    }
    writes.push(putSetting(key, value))
  })
  await Promise.all(writes)
  if (Object.keys(patch).length) {
    await writeAudit(actor, 'Settings updated', Object.keys(patch).join(', '))
  }
}

export function buildBackup(rows, settings) {
  return {
    app: 'MatatuPulse',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    tables: Object.fromEntries(rows.map((row) => [row.name, row.rows]))
  }
}

export async function restoreBackup(payload, actor) {
  assertCan(actor.role, 'manageBackups')
  if (payload?.app !== 'MatatuPulse' || !payload.tables || !payload.settings) {
    throw new Error('This file is not a MatatuPulse backup.')
  }
  const tableNames = ['vehicles', 'trips', 'expenses', 'remittances', 'dispatch', 'compliance', 'audit']
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
    for (const name of tableNames) {
      const rows = payload.tables[name]
      if (!Array.isArray(rows)) continue
      await db.table(name).bulkPut(rows)
    }
    await Promise.all(Object.entries(payload.settings).map(([key, value]) => db.settings.put({ key, value })))
  })
  await writeAudit(actor, 'Backup restored', `${Object.values(payload.tables).reduce((n, rows) => n + (rows?.length || 0), 0)} records imported`)
}
