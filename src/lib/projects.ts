export interface ProjectRecord {
  id: string
  userId: string
  name: string
  createdAt: number
  updatedAt: number
  favorite: boolean
  /** Data URL thumbnail snapshot (optional, small) */
  thumb?: string
}

const KEY = 'bignac-projects-v1'

function readAll(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ProjectRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(items: ProjectRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function listProjects(userId: string): ProjectRecord[] {
  return readAll()
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createProject(userId: string, name = 'Untitled project'): ProjectRecord {
  const now = Date.now()
  const project: ProjectRecord = {
    id: uid(),
    userId,
    name,
    createdAt: now,
    updatedAt: now,
    favorite: false,
  }
  const all = readAll()
  all.push(project)
  writeAll(all)
  return project
}

export function touchProject(id: string, patch: Partial<Pick<ProjectRecord, 'name' | 'thumb' | 'favorite'>>) {
  const all = readAll()
  const idx = all.findIndex((p) => p.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() }
  writeAll(all)
  return all[idx]
}

export function deleteProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id))
}

export function toggleFavorite(id: string) {
  const all = readAll()
  const idx = all.findIndex((p) => p.id === id)
  if (idx < 0) return null
  all[idx].favorite = !all[idx].favorite
  all[idx].updatedAt = Date.now()
  writeAll(all)
  return all[idx]
}

export function getProject(id: string): ProjectRecord | null {
  return readAll().find((p) => p.id === id) ?? null
}
