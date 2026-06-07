import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import HomeScreen from './screens/HomeScreen'
import CalendarScreen from './screens/CalendarScreen'
import TemplatesScreen from './screens/TemplatesScreen'
import FeedbackScreen from './screens/FeedbackScreen'
import RewardsScreen from './screens/RewardsScreen'
import InsightsScreen from './screens/InsightsScreen'
import SubjectsScreen from './screens/SubjectsScreen'
import StudyAnalysisScreen from './screens/StudyAnalysisScreen'
import { db } from './db'
import { pullFromCloud, pushRecord, pushToCloud } from './sync'

export default function App() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [syncing, setSyncing] = useState(true)
  const [syncStatus, setSyncStatus] = useState('syncing') // 'syncing' | 'ok' | 'error'
  const pendingPushes = useRef([])
  const pushTimer = useRef(null)

  useEffect(() => {
    initApp()

    // App wapas foreground mein aane pe pull karo
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        silentPull()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function initApp() {
    setSyncing(true)
    setSyncStatus('syncing')
    try {
      await pullFromCloud()
      setSyncStatus('ok')
    } catch (e) {
      console.log('Initial pull failed:', e)
      setSyncStatus('error')
    }
    await refreshPoints()
    setSyncing(false)
  }

  // Background pull — UI block nahi hota
  async function silentPull() {
    try {
      await pullFromCloud()
      await refreshPoints()
      setSyncStatus('ok')
    } catch (e) {
      setSyncStatus('error')
    }
  }

  async function refreshPoints() {
    try {
      const allTasks = await db.tasks.toArray()
      const pts = allTasks
        .filter(t => t.completed && t.date !== 'template')
        .reduce((sum, t) => sum + (Number(t.points) || 0), 0)
      const reds = await db.redemptions?.toArray?.() || []
      const redPts = reds.reduce((s, r) => s + (Number(r.cost) || 0), 0)
      setTotalPoints(Math.max(0, pts - redPts))
    } catch (e) {
      console.log('refreshPoints error:', e)
    }
  }

  // Debounced push — multiple rapid changes ko batch karo
  const schedulePush = useCallback((table, record) => {
    if (table && record) {
      pendingPushes.current.push({ table, record })
    }
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      const pushes = [...pendingPushes.current]
      pendingPushes.current = []
      setSyncStatus('syncing')
      try {
        await Promise.all(pushes.map(({ table, record }) => pushRecord(table, record)))
        setSyncStatus('ok')
      } catch (e) {
        setSyncStatus('error')
        // Retry after 3 sec
        setTimeout(() => {
          Promise.all(pushes.map(({ table, record }) => pushRecord(table, record)))
            .then(() => setSyncStatus('ok'))
            .catch(() => setSyncStatus('error'))
        }, 3000)
      }
    }, 500) // 500ms debounce
  }, [])

  async function handleDataChange(table, record) {
    await refreshPoints()
    schedulePush(table, record)
  }

  // Manual sync
  async function handleManualSync() {
    setSyncStatus('syncing')
    try {
      await pullFromCloud()
      await refreshPoints()
      setSyncStatus('ok')
    } catch {
      setSyncStatus('error')
    }
  }

  if (syncing) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f8fafc',
        fontFamily: 'Nunito, sans-serif', flexDirection: 'column', gap: '12px',
      }}>
        <p style={{ fontSize: '28px', fontWeight: '900', color: '#38bdf8' }}>KitnaHua</p>
        <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>Syncing data...</p>
        <div style={{
          width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: '#38bdf8', borderRadius: '99px',
            animation: 'slide 1s infinite',
            width: '60%',
          }} />
        </div>
        <style>{`@keyframes slide { 0% { transform: translateX(-100%) } 100% { transform: translateX(250%) } }`}</style>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div style={{
        maxWidth: '414px',
        margin: '0 auto',
        minHeight: '100vh',
        background: '#f8fafc',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <TopBar totalPoints={totalPoints} syncStatus={syncStatus} onManualSync={handleManualSync} />
        <div style={{ flex: 1, paddingBottom: '70px' }}>
          <Routes>
            <Route path="/" element={<HomeScreen onPointsUpdate={handleDataChange} />} />
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/templates" element={<TemplatesScreen />} />
            <Route path="/feedback" element={<FeedbackScreen onSave={handleDataChange} />} />
            <Route path="/rewards" element={<RewardsScreen onRedeem={handleDataChange} />} />
            <Route path="/insights" element={<InsightsScreen />} />
            <Route path="/subjects" element={<SubjectsScreen />} />
            <Route path="/study-analysis" element={<StudyAnalysisScreen />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}