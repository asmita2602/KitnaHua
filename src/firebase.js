import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCeYIyWWSTkATz3XT2IMfuljz9Wn2oHD4",
  authDomain: "kitnahua-9b0fb.firebaseapp.com",
  projectId: "kitnahua-9b0fb",
  storageBucket: "kitnahua-9b0fb.firebasestorage.app",
  messagingSenderId: "310642471378",
  appId: "1:310642471378:web:941f2b2e99b0c0842dd80b"
}

const app = initializeApp(firebaseConfig)
export const firestoreDb = getFirestore(app)