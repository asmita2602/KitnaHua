import { db } from './db'

const TABLES = ['days', 'tasks', 'feedback', 'rewards', 'redemptions', 'subjects', 'topics', 'lectures']
const BACKUP_KEY = 'kitnahua_backup'
const BACKUP_DATE_KEY = 'kitnahua_backup_date'

export async function backupToLocal() {
  try {
    const backup = {}
    for (const table of TABLES) {
      backup[table] = await db[table].toArray()
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
    localStorage.setItem(BACKUP_DATE_KEY, new Date().toISOString())
    return true
  } catch (e) { return false }
}

export async function restoreFromBackup() {
  try {
    const backupStr = localStorage.getItem(BACKUP_KEY)
    if (!backupStr) return false
    const backup = JSON.parse(backupStr)
    for (const table of TABLES) {
      if (backup[table]?.length > 0) {
        await db[table].bulkPut(backup[table])
      }
    }
    return true
  } catch (e) { return false }
}

export async function exportData() {
  try {
    const backup = {}
    for (const table of TABLES) {
      backup[table] = await db[table].toArray()
    }
    backup._exportDate = new Date().toISOString()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kitnahua_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  } catch (e) { return false }
}

export async function importData(file) {
  try {
    const text = await file.text()
    const backup = JSON.parse(text)
    for (const table of TABLES) {
      if (backup[table]?.length > 0) {
        await db[table].clear()
        await db[table].bulkAdd(backup[table])
      }
    }
    return true
  } catch (e) { return false }
}

export async function autoBackup() {
  const lastBackup = localStorage.getItem(BACKUP_DATE_KEY)
  if (lastBackup) {
    const diff = new Date() - new Date(lastBackup)
    if (diff < 30 * 60 * 1000) return
  }
  await backupToLocal()
}

export async function initApp() {
  try {
    const taskCount = await db.tasks.count()
    const subjectCount = await db.subjects.count()
    if (taskCount === 0 && subjectCount === 0) {
      const hasBackup = localStorage.getItem(BACKUP_KEY)
      if (hasBackup) await restoreFromBackup()
    }
    await backupToLocal()
  } catch (e) {}
}

export async function pushRecord() { return true }
export async function deleteRecord() { return true }
export async function pushToCloud() { return true }
export async function pullFromCloud() { return true }
export function startRealtimeSync() { return () => {} }