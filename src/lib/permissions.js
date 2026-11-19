export const ROLES = {
  owner: {
    id: 'owner',
    label: 'Fleet Owner / SACCO Admin',
    short: 'Owner / Admin',
    description: 'Full command of fleet finances, targets, compliance and audit exports.'
  },
  field: {
    id: 'field',
    label: 'Crew / Stage Marshal',
    short: 'Crew / Marshal',
    description: 'Field logging only — collections, expenses and live stage dispatch.'
  }
}

export const PERMISSIONS = {
  logTrips: ['owner', 'field'],
  logExpenses: ['owner', 'field'],
  updateDispatch: ['owner', 'field'],
  manageQueue: ['owner'],
  settleRemittance: ['owner'],
  deleteLogs: ['owner'],
  manageTargets: ['owner'],
  manageCompliance: ['owner'],
  exportAudit: ['owner'],
  manageBackups: ['owner'],
  viewAnalytics: ['owner']
}

export function can(role, permission) {
  return Boolean(PERMISSIONS[permission]?.includes(role))
}

export function assertCan(role, permission) {
  if (!can(role, permission)) {
    throw new Error(`${ROLES[role]?.short || role} cannot ${permission.replace(/([A-Z])/g, ' $1').toLowerCase()}.`)
  }
  return true
}
