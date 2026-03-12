import { seedData } from '../data/seed'

const APP_STATE_KEY = 'northstar-hris-state'
const SESSION_KEY = 'northstar-hris-session'

const clone = (value) => JSON.parse(JSON.stringify(value))

export function loadAppState() {
  const fallback = clone(seedData)

  try {
    const raw = window.localStorage.getItem(APP_STATE_KEY)

    if (!raw) {
      return fallback
    }

    return {
      ...fallback,
      ...JSON.parse(raw),
    }
  } catch {
    return fallback
  }
}

export function saveAppState(state) {
  window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(state))
}

export function resetAppState() {
  window.localStorage.removeItem(APP_STATE_KEY)
  return clone(seedData)
}

export function loadSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY)
}

export function loginWithPlaceholder({ email, role }) {
  const selectedProfile = seedData.profiles[role] ?? seedData.profiles.employee
  const safeEmail = email?.trim() || `${role}@northstarhris.dev`

  return {
    id: `${role}-${safeEmail}`,
    email: safeEmail,
    name: selectedProfile.name,
    role: selectedProfile.role,
    title: selectedProfile.title,
  }
}
