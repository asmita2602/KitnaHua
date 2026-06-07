import { firestoreDb } from './firebase'
import { db } from './db'
import {
  collection, doc, setDoc, getDocs, deleteDoc, onSnapshot
} from 'firebase/firestore'

const USER_ID = 'asmita'
const TABLES = ['days', 'tasks', 'feedback', 'rewards', 'redemptions', 'subjects', 'topics', 'lectures']

// Push local data to Firestore
export async function pushToCloud() {
  for (const table of TABLES) {
    try {
      const records = await db[table].toArray()
      for (const record of records) {
        const id = String(record.id || record.date || Math.random())
        const ref = doc(firestoreDb, USER_ID, table, 'data', id)
        await setDoc(ref, JSON.parse(JSON.stringify(record)))
      }
    } catch (e) {
      console.log(`Push error for ${table}:`, e)
    }
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

// Listen for realtime changes from Firestore
export function startRealtimeSync(onUpdate) {
  const unsubs = []
  for (const table of TABLES) {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const unsub = onSnapshot(colRef, async (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return
        const records = snapshot.docs.map(d => d.data())
        if (records.length > 0) {
          await db[table].clear()
          await db[table].bulkPut(records)
          onUpdate?.()
        }
      })
      unsubs.push(unsub)
    } catch (e) {
      console.log(`Realtime sync error for ${table}:`, e)
    }
  }
  return () => unsubs.forEach(u => u())
}