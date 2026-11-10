export interface User {
  id: string
  name: string
  email: string
  createdAt: number
}

interface StoredUser extends User {
  password: string
}

const USERS_KEY = 'bignac-users-v1'
const SESSION_KEY = 'bignac-session-v1'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? (JSON.parse(raw) as StoredUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getCurrentUser(): User | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const user = readUsers().find((u) => u.id === id)
    if (!user) return null
    const { password: _p, ...safe } = user
    return safe
  } catch {
    return null
  }
}

export function signUp(name: string, email: string, password: string): User {
  const users = readUsers()
  const normalized = email.trim().toLowerCase()
  if (!name.trim()) throw new Error('Please enter your name.')
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Please enter a valid email address.')
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.')
  if (users.some((u) => u.email === normalized)) {
    throw new Error('An account with that email already exists.')
  }
  const user: StoredUser = {
    id: uid(),
    name: name.trim(),
    email: normalized,
    password,
    createdAt: Date.now(),
  }
  users.push(user)
  writeUsers(users)
  localStorage.setItem(SESSION_KEY, user.id)
  const { password: _p, ...safe } = user
  return safe
}

export function signIn(email: string, password: string): User {
  const normalized = email.trim().toLowerCase()
  const users = readUsers()
  const user = users.find((u) => u.email === normalized)
  if (!user || user.password !== password) {
    throw new Error('Incorrect email or password.')
  }
  localStorage.setItem(SESSION_KEY, user.id)
  const { password: _p, ...safe } = user
  return safe
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY)
}
