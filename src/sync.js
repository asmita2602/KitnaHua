import { firestoreDb } from './firebase'
import { db } from './db'
import {
  collection, doc, setDoc, getDocs, writeBatch, deleteDoc
} from 'firebase/firestore'

const USER_ID = 'asmita'
const TABLES = [
  'days', 'tasks', 'feedback', 'rewards',
  'redemptions', 'subjects', 'topics', 'lectures'
]

function getRecordId(table, record) {
  if (record.id !== undefined && record.id !== null) return String(record.id)
  if (record.date !== undefined) return String(record.date)
  return String(Date.now())
}

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v))
}

// ── PULL: App open pe ek baar saara data fetch ──────────────────
export async function pullFromCloud() {
  const promises = TABLES.map(async (table) => {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const snapshot = await getDocs(colRef)
      if (snapshot.empty) return
      const records = snapshot.docs.map(d => d.data())
      await db[table].clear()
      await db[table].bulkPut(records)
    } catch (e) {
      console.log(`pull error [${table}]:`, e)
    }
  })
  // Saare tables parallel mein fetch karo
  await Promise.all(promises)
}

// ── PUSH SINGLE RECORD: Koi bhi change hote hi call karo ────────
export async function pushRecord(table, record) {
  try {
    const id = getRecordId(table, record)
    const ref = doc(firestoreDb, USER_ID, table, 'data', id)
    await setDoc(ref, sanitize(record))
  } catch (e) {
    console.log(`pushRecord error [${table}]:`, e)
    // Retry once
    try {
      const id = getRecordId(table, record)
      const ref = doc(firestoreDb, USER_ID, table, 'data', id)
      await setDoc(ref, sanitize(record))
    } catch {}
  }
}

// ── PUSH TABLE: Puri table sync karo (backup ke liye) ───────────
export async function pushTable(table) {
  try {
    const records = await db[table].toArray()
    if (records.length === 0) return

    const chunks = []
    for (let i = 0; i < records.length; i += 400) {
      chunks.push(records.slice(i, i + 400))
    }
    for (const chunk of chunks) {
      const batch = writeBatch(firestoreDb)
      for (const record of chunk) {
        const id = getRecordId(table, record)
        const ref = doc(firestoreDb, USER_ID, table, 'data', id)
        batch.set(ref, sanitize(record))
      }
      await batch.commit()
    }
  } catch (e) {
    console.log(`pushTable error [${table}]:`, e)
  }
}

// ── DELETE RECORD: Record delete hone pe call karo ──────────────
export async function deleteRecord(table, id) {
  try {
    const ref = doc(firestoreDb, USER_ID, table, 'data', String(id))
    await deleteDoc(ref)
  } catch (e) {
    console.log(`deleteRecord error [${table}]:`, e)
  }
}

// ── PUSH ALL: Full sync (sirf pehli baar ya manual sync pe) ─────
export async function pushToCloud() {
  await Promise.all(TABLES.map(table => pushTable(table)))
}

// startRealtimeSync hata diya — not needed for single user
export function startRealtimeSync() { return () => {} }