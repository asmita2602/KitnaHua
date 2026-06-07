import { firestoreDb } from './firebase'
import { db } from './db'
import {
  collection, doc, setDoc, getDocs,
  writeBatch, onSnapshot
} from 'firebase/firestore'

const USER_ID = 'asmita'
const TABLES = ['days', 'tasks', 'feedback', 'rewards', 'redemptions', 'subjects', 'topics', 'lectures']

function getRecordId(table, record) {
  if (record.id !== undefined) return String(record.id)
  if (record.date !== undefined) return String(record.date)
  return String(Math.random())
}

// Push local data to Firestore using batch writes
export async function pushToCloud() {
  for (const table of TABLES) {
    try {
      const records = await db[table].toArray()
      if (records.length === 0) continue

      // Firestore batch max 500 ops
      const chunks = []
      for (let i = 0; i < records.length; i += 400) {
        chunks.push(records.slice(i, i + 400))
      }

      for (const chunk of chunks) {
        const batch = writeBatch(firestoreDb)
        for (const record of chunk) {
          const id = getRecordId(table, record)
          const ref = doc(firestoreDb, USER_ID, table, 'data', id)
          batch.set(ref, JSON.parse(JSON.stringify(record)))
        }
        await batch.commit()
      }
    } catch (e) {
      console.log(`Push error for ${table}:`, e)
    }
  }
}

// Push single record
export async function pushRecord(table, record) {
  try {
    const id = getRecordId(table, record)
    const ref = doc(firestoreDb, USER_ID, table, 'data', id)
    await setDoc(ref, JSON.parse(JSON.stringify(record)))
  } catch (e) {
    console.log(`Push record error for ${table}:`, e)
  }
}

// Pull Firestore data to local IndexedDB
export async function pullFromCloud() {
  for (const table of TABLES) {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const snapshot = await getDocs(colRef)
      if (snapshot.empty) continue
      const records = snapshot.docs.map(d => d.data())
      await db[table].clear()
      await db[table].bulkPut(records)
    } catch (e) {
      console.log(`Pull error for ${table}:`, e)
    }
  }
}

// Realtime listener — only syncs when cloud changes from another device
export function startRealtimeSync(onUpdate) {
  const unsubs = []
  for (const table of TABLES) {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const unsub = onSnapshot(colRef, { includeMetadataChanges: false }, async (snapshot) => {
        const changes = snapshot.docChanges()
        if (changes.length === 0) return

        // Only process changes from server (not local writes)
        const serverChanges = changes.filter(c => !c.doc.metadata.hasPendingWrites)
        if (serverChanges.length === 0) return

        for (const change of serverChanges) {
          const data = change.doc.data()
          if (change.type === 'removed') {
            try { await db[table].delete(data.id || data.date) } catch {}
          } else {
            try { await db[table].put(data) } catch {}
          }
        }
        onUpdate?.()
      })
      unsubs.push(unsub)
    } catch (e) {
      console.log(`Realtime sync error for ${table}:`, e)
    }
  }
  return () => unsubs.forEach(u => u())
}