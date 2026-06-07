import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { db } from './db.js'

async function initApp() {
  try {
    await db.cloud.login({
      grant_type: 'demo',
      username: 'asmita@kitnahu',
    })
  } catch (e) {
    console.log('Cloud login:', e)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initApp()