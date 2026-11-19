import 'fake-indexeddb/auto'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html data-theme="neon"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.SVGElement = dom.window.SVGElement
globalThis.MutationObserver = dom.window.MutationObserver
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.scrollTo = () => {}

window.matchMedia = () => ({
  matches: false,
  media: '',
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {}
})
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const { default: App } = await import('../src/App.jsx')
const { AppProvider } = await import('../src/context/AppContext.jsx')
const { seedDatabase, ensureSettings, db } = await import('../src/db/db.js')
const {
  getDayTotals,
  addTrip,
  settleRemittance,
  updateDispatchEntry,
  deleteLedgerEntry,
  updateSettings,
  updateComplianceRecord,
  buildBackup,
  restoreBackup
} = await import('../src/db/actions.js')
const { localISO } = await import('../src/lib/format.js')

await seedDatabase()
await ensureSettings()

const errors = []
const originalError = console.error
console.error = (...args) => {
  errors.push(args.map(String).join(' '))
  originalError(...args)
}

const root = createRoot(document.getElementById('root'))
await act(async () => {
  root.render(React.createElement(AppProvider, null, React.createElement(App)))
})
await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)) })

const text = () => document.body.textContent || ''
const assert = (condition, label) => {
  if (!condition) throw new Error(`Smoke test failed: ${label}`)
  console.log(`ok · ${label}`)
}

assert(text().includes('Trip & Daily Remittance Ledger'), 'remittance ledger renders')
assert(text().includes('Gross collections'), 'KPI cards render')
assert((await db.trips.count()) >= 20, 'offline seed data written to IndexedDB')

const clickByText = async (needle) => {
  const button = [...document.querySelectorAll('button')].find((el) => el.textContent?.includes(needle))
  if (!button) throw new Error(`Button not found: ${needle}`)
  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 650))
  })
}

await clickByText('Stage Dispatch')
assert(text().includes('Stage Dispatch & Queue Timer'), 'dispatch tab renders')
await clickByText('Fleet Health')
assert(text().includes('Fleet Compliance & Service Tracker'), 'fleet compliance tab renders')
await clickByText('Settings')
assert(text().includes('Android APK Center'), 'settings and APK center render')

await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) })
assert(errors.filter((e) => !e.includes('not wrapped in act')).length === 0, 'no React runtime errors')

// Domain logic checks against the real IndexedDB layer.
const vehicle = await db.vehicles.toCollection().first()
const before = await getDayTotals(vehicle.id, localISO())
const tripId = await addTrip({
  vehicleId: vehicle.id,
  date: localISO(),
  route: vehicle.route,
  rounds: 1,
  passengers: 5,
  fare: 400
}, { name: 'Smoke Marshal', role: 'field' })
const after = await getDayTotals(vehicle.id, localISO())
assert(after.gross === before.gross + 2000, 'trip collection updates ledger totals')
await settleRemittance(vehicle.id, localISO(), { name: 'Smoke Owner', role: 'owner' })
assert((await db.remittances.where('[vehicleId+date]').equals([vehicle.id, localISO()]).first())?.status === 'settled', 'owner settlement writes a receipt')
const queueEntry = await db.dispatch.toCollection().first()
await updateDispatchEntry(queueEntry.id, { status: 'boarding' }, { name: 'Smoke Marshal', role: 'field' })
assert((await db.dispatch.get(queueEntry.id))?.status === 'boarding', 'field marshal can update dispatch state')

// Role boundaries are enforced in the data layer, not only in the UI.
const field = { name: 'Smoke Marshal', role: 'field' }
const owner = { name: 'Smoke Owner', role: 'owner' }
const mustReject = async (task, label) => {
  let rejected = false
  try { await task() } catch { rejected = true }
  assert(rejected, label)
}

await mustReject(() => settleRemittance(vehicle.id, localISO(), field), 'field cannot settle remittances')
await mustReject(() => deleteLedgerEntry('trips', tripId, field), 'field cannot delete ledger entries')
await mustReject(() => updateSettings({ dailyTarget: 999 }, field), 'field cannot change daily targets')
await mustReject(() => updateComplianceRecord(vehicle.id, { mileage: 1 }, field), 'field cannot edit compliance dates')

const originalStage = (await db.dispatch.get(queueEntry.id))?.stage
await updateDispatchEntry(queueEntry.id, { stage: 'Nairobi Stage' }, field)
assert((await db.dispatch.get(queueEntry.id))?.stage === originalStage, 'field cannot reassign a vehicle stage')

const originalTarget = (await db.settings.get('dailyTarget'))?.value
await updateSettings({ dailyTarget: 20000 }, owner)
assert((await db.settings.get('dailyTarget'))?.value === 20000, 'owner can update daily targets')
await updateSettings({ dailyTarget: originalTarget }, owner)

const rows = await Promise.all(db.tables.map(async (table) => ({ name: table.name, rows: await table.toArray() })))
const backup = buildBackup(rows, await ensureSettings())
assert(backup.app === 'MatatuPulse' && backup.tables.trips.length >= 20, 'JSON backup captures every local table')
await mustReject(() => restoreBackup(backup, field), 'field cannot restore backups')
await restoreBackup(backup, owner)
assert((await db.trips.count()) === backup.tables.trips.length, 'owner backup restore round-trips record counts')

await db.trips.delete(tripId)
console.log('All smoke checks passed.')
process.exit(0)
