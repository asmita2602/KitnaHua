import { firestoreDb } from './firebase'
import { db } from './db'
import {
  collection, doc, setDoc, getDocs,
  writeBatch, onSnapshot, serverTimestamp
} from 'firebase/firestore'

const USER_ID = 'asmita'
const TABLES = ['days', 'tasks', 'feedback', 'rewards', 'redemptions', 'subjects', 'topics', 'lectures']

function getRecordId(table, record) {
  if (record.id !== undefined && record.id !== null) return String(record.id)
  if (record.date !== undefined) return String(record.date)
  return String(Date.now() + Math.random())
}

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v))
}

// Push single record immediately
export async function pushRecord(table, record) {
  try {
    const id = getRecordId(table, record)
    const ref = doc(firestoreDb, USER_ID, table, 'data', id)
    await setDoc(ref, sanitize(record))
  } catch (e) {
    console.log(`pushRecord error [${table}]:`, e)
  }
}

// Push all local data to Firestore (full sync)
export async function pushToCloud() {
  for (const table of TABLES) {
    try {
      const records = await db[table].toArray()
      if (records.length === 0) continue
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
      console.log(`pushToCloud error [${table}]:`, e)
    }
  }
}

// Pull all Firestore data to local
export async function pullFromCloud() {
  let anyData = false
  for (const table of TABLES) {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const snapshot = await getDocs(colRef)
      if (snapshot.empty) continue
      anyData = true
      const records = snapshot.docs.map(d => d.data())
      await db[table].clear()
      await db[table].bulkPut(records)
    } catch (e) {
      console.log(`pullFromCloud error [${table}]:`, e)
    }
  }
  return anyData
}

// Realtime sync — only updates changed records, does not clear local data
export function startRealtimeSync(onUpdate) {
  const unsubs = []

  for (const table of TABLES) {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      let initialized = false

      const unsub = onSnapshot(
        colRef,
        { includeMetadataChanges: false },
        async (snapshot) => {
          // Skip first snapshot (initial load already done by pullFromCloud)
          if (!initialized) {
            initialized = true
            return
          }

          const changes = snapshot.docChanges()
          if (changes.length === 0) return

          // Only process server changes
          const serverChanges = changes.filter(c => !c.doc.metadata.hasPendingWrites)
          if (serverChanges.length === 0) return

          let changed = false
          for (const change of serverChanges) {
            const data = change.doc.data()
            try {
              if (change.type === 'removed') {
                const id = data.id !== undefined ? data.id : data.date
                if (id !== undefined) await db[table].delete(id)
              } else {
                await db[table].put(data)
                changed = true
              }
            } catch (e) {
              console.log(`Realtime update error [${table}]:`, e)
            }
          }
          if (changed) onUpdate?.()
        },
        (error) => {
          console.log(`Snapshot error [${table}]:`, error)
        }
      )
      unsubs.push(unsub)
    } catch (e) {
      console.log(`startRealtimeSync error [${table}]:`, e)
    }
  }

  return () => unsubs.forEach(u => u())
}