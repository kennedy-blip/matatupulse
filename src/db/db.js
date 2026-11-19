import Dexie from 'dexie'

/**
 * MatatuPulse local-first database.
 * Every ledger, dispatch and compliance write lands in IndexedDB first, so a
 * conductor at a stage with no signal can keep collecting and reconciling.
 */
export const db = new Dexie('MatatuPulseDB')

db.version(1).stores({
  vehicles: 'id, reg, route, driver, stage, active',
  trips: '++id, vehicleId, date, collectedBy, createdAt, [vehicleId+date]',
  expenses: '++id, vehicleId, date, category, createdBy, createdAt, [vehicleId+date]',
  remittances: '++id, vehicleId, date, status, [vehicleId+date]',
  dispatch: '++id, vehicleId, stage, status, createdAt, departedAt',
  compliance: 'id, vehicleId, ntsaExpiry, insuranceExpiry',
  settings: 'key',
  audit: '++id, at, actor, action'
})

export const DEFAULT_SETTINGS = {
  theme: 'neon',
  role: 'owner',
  dailyTarget: 45000,
  expenseLimit: 18000,
  dispatchIntervalMin: 12,
  stage: 'Meru Main Stage',
  ownerName: 'Wakama SACCO',
  operatorName: 'Grace Wambui',
  seededAt: null
}

export async function ensureSettings() {
  const existing = await db.settings.toArray()
  const byKey = new Map(existing.map((row) => [row.key, row.value]))
  const missing = Object.entries(DEFAULT_SETTINGS)
    .filter(([key]) => !byKey.has(key))
    .map(([key, value]) => ({ key, value }))
  if (missing.length) await db.settings.bulkAdd(missing)
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(byKey) }
}

export async function getSetting(key, fallback) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export async function putSetting(key, value) {
  await db.settings.put({ key, value })
}

const VEHICLE_SEED = [
  { id: 'KDG-412X', reg: 'KDG 412X', route: 'Meru ↔ Nairobi', driver: 'Joseph Muthomi', stage: 'Meru Main Stage', capacity: 14, active: true },
  { id: 'KDH-218M', reg: 'KDH 218M', route: 'Meru ↔ Embu', driver: 'Peter Kariuki', stage: 'Tawakali Stage', capacity: 14, active: true },
  { id: 'KDB-774K', reg: 'KDB 774K', route: 'Meru ↔ Isiolo', driver: 'Mary Wanjiku', stage: 'Meru Main Stage', capacity: 11, active: true },
  { id: 'KDC-109Z', reg: 'KDC 109Z', route: 'Meru ↔ Thika', driver: 'Ali Hassan', stage: 'Tawakali Stage', capacity: 14, active: true }
]

const EXPENSE_SEED = [
  { category: 'Fuel', amount: 6800, note: 'Full tank – Shell Meru' },
  { category: 'Stage Fee', amount: 1200, note: 'Stage levy' },
  { category: 'Car Wash', amount: 450, note: 'End-of-day wash' },
  { category: 'Squad', amount: 900, note: 'Squad / conductor float' }
]

function localISO(date) {
  const d = new Date(date)
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export async function seedDatabase() {
  if (await db.vehicles.count()) return
  const now = Date.now()
  const today = localISO(now)

  const vehicles = VEHICLE_SEED.map((v) => ({ ...v, createdAt: now }))
  const compliance = VEHICLE_SEED.map((v, i) => ({
    id: v.id,
    vehicleId: v.id,
    mileage: 68240 + i * 11760,
    lastServiceKm: 62400 + i * 10900,
    oilChangeIntervalKm: 8000,
    lastServiceDate: localISO(now - (16 + i * 5) * 86400000),
    ntsaExpiry: localISO(now + (i === 1 ? -4 : 18 + i * 24) * 86400000),
    insuranceExpiry: localISO(now + (i === 3 ? 9 : 42 + i * 30) * 86400000),
    updatedAt: now
  }))

  const trips = []
  const expenses = []
  for (let day = 6; day >= 0; day--) {
    const date = localISO(now - day * 86400000)
    VEHICLE_SEED.forEach((vehicle, vi) => {
      // No log for the newest day on one vehicle: keeps the "pending" workflow visible.
      if (day === 0 && vi === 3) return
      const rounds = 3 + Math.floor(seeded(day * 17 + vi * 5) * 3)
      const passengers = 9 + Math.floor(seeded(day * 7 + vi * 11 + 2) * 6)
      const fare = [450, 380, 300, 500][vi]
      trips.push({
        vehicleId: vehicle.id,
        date,
        route: vehicle.route,
        rounds,
        passengers,
        fare,
        gross: rounds * passengers * fare,
        collectedBy: vi % 2 === 0 ? 'Joseph Muthomi' : 'Grace Wambui',
        note: `Round-trip collections · ${vehicle.route}`,
        createdAt: now - day * 86400000 + vi * 3600000
      })
      EXPENSE_SEED.forEach((expense, ei) => {
        if (day === 0 && ei === 3) return
        const jitter = 0.82 + seeded(day * 13 + vi * 3 + ei) * 0.36
        expenses.push({
          vehicleId: vehicle.id,
          date,
          category: expense.category,
          amount: Math.round((expense.amount * jitter) / 10) * 10,
          note: expense.note,
          receiptNo: `RCP-${String(day + 1).padStart(2, '0')}${vi + 1}${ei + 1}`,
          createdBy: 'Joseph Muthomi',
          createdAt: now - day * 86400000 + vi * 3600000 + ei * 60000
        })
      })
    })
  }

  const dispatch = [
    { vehicleId: 'KDG-412X', stage: 'Meru Main Stage', status: 'boarding', notes: 'Loading passengers', boardedAt: now - 4 * 60000 },
    { vehicleId: 'KDH-218M', stage: 'Meru Main Stage', status: 'queued', notes: 'Turnaround completed' },
    { vehicleId: 'KDB-774K', stage: 'Tawakali Stage', status: 'queued', notes: 'Awaiting bay' },
    { vehicleId: 'KDC-109Z', stage: 'Meru Main Stage', status: 'delayed', notes: 'Driver reporting late' }
  ].map((row, i) => ({ ...row, createdAt: now - (12 - i * 3) * 60000, updatedAt: now }))

  const audit = [{
    at: now,
    actor: 'System',
    role: 'owner',
    action: 'Workspace initialised',
    detail: 'Seed demo fleet, ledger and dispatch data'
  }]

  await db.transaction('rw', db.tables, async () => {
    await Promise.all([
      db.vehicles.bulkAdd(vehicles),
      db.compliance.bulkPut(compliance),
      db.trips.bulkAdd(trips),
      db.expenses.bulkAdd(expenses),
      db.dispatch.bulkAdd(dispatch),
      db.audit.bulkAdd(audit)
    ])
    await db.settings.put({ key: 'seededAt', value: new Date(today).toISOString() })
  })
}

export async function resetWorkspace() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.filter((table) => table.name !== 'settings').map((table) => table.clear()))
  })
  await seedDatabase()
}

export async function workspaceStats() {
  const [trips, expenses, remittances, dispatch, vehicles, compliance, audit] = await Promise.all([
    db.trips.count(),
    db.expenses.count(),
    db.remittances.count(),
    db.dispatch.count(),
    db.vehicles.count(),
    db.compliance.count(),
    db.audit.count()
  ])
  let usage = null
  let quota = null
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage = estimate.usage ?? null
      quota = estimate.quota ?? null
    }
  } catch {
    // Storage estimate is best-effort; record counts still give a true picture.
  }
  return {
    records: { trips, expenses, remittances, dispatch, vehicles, compliance, audit },
    total: trips + expenses + remittances + dispatch + vehicles + compliance + audit,
    usage,
    quota
  }
}
