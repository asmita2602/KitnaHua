import { firestoreDb } from './firebase'
import { db } from './db'
import {
  collection, doc, setDoc, getDocs, writeBatch, deleteDoc, getDoc
} from 'firebase/firestore'

const USER_ID = 'asmita'
const TABLES = ['days', 'tasks', 'feedback', 'rewards', 'redemptions', 'subjects', 'topics', 'lectures']

function getRecordId(table, record) {
  if (record.id !== undefined && record.id !== null) return String(record.id)
  if (record.date !== undefined) return String(record.date)
  return String(Date.now())
}

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v))
}

// Push single record to Firestore
export async function pushRecord(table, record) {
  try {
    const id = getRecordId(table, record)
    const ref = doc(firestoreDb, USER_ID, table, 'data', id)
    await setDoc(ref, sanitize(record))
    return true
  } catch (e) {
    console.log(`pushRecord error [${table}]:`, e)
    return false
  }
}

// Delete record from Firestore
export async function deleteRecord(table, id) {
  try {
    const ref = doc(firestoreDb, USER_ID, table, 'data', String(id))
    await deleteDoc(ref)
    return true
  } catch (e) {
    console.log(`deleteRecord error [${table}]:`, e)
    return false
  }
}

// Pull from Firestore — MERGE only, never clear local data
export async function pullFromCloud() {
  const promises = TABLES.map(async (table) => {
    try {
      const colRef = collection(firestoreDb, USER_ID, table, 'data')
      const snapshot = await getDocs(colRef)
      if (snapshot.empty) return // Firestore empty hai toh local touch mat karo
      const records = snapshot.docs.map(d => d.data())
      // Merge — existing local records ko overwrite karo, delete mat karo
      await db[table].bulkPut(records)
    } catch (e) {
      console.log(`pull error [${table}]:`, e)
    }
  })
  await Promise.all(promises)
}

// Push entire table to Firestore
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

// Push all local data to Firestore
export async function pushToCloud() {
  await Promise.all(TABLES.map(table => pushTable(table)))
}

export function startRealtimeSync() { return () => {} }