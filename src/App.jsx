import { useState, useEffect } from 'react'
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
import { pullFromCloud, pushToCloud, pushRecord, startRealtimeSync } from './sync'

export default function App() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [syncing, setSyncing] = useState(true)

  useEffect(() => {
    initSync()
  }, [])

  async function initSync() {
    setSyncing(true)
    try {
      await pullFromCloud()
    } catch (e) {
      console.log('Initial pull failed:', e)
    }
    setSyncing(false)
    refreshPoints()

    const stopSync = startRealtimeSync(() => {
      refreshPoints()
    })

    return () => stopSync()
  }

  async function refreshPoints() {
    const allTasks = await db.tasks.toArray()
    const pts = allTasks
      .filter(t => t.completed && t.date !== 'template')
      .reduce((sum, t) => sum + (t.points || 0), 0)
    let redPts = 0
    try {
      const reds = await db.redemptions?.toArray?.() || []
      redPts = reds.reduce((s, r) => s + (r.cost || 0), 0)
    } catch {}
    setTotalPoints(Math.max(0, pts - redPts))
  }

  async function handleDataChange(table, record) {
    refreshPoints()
    try {
      if (table && record) {
        await pushRecord(table, record)
      } else {
        await pushToCloud()
      }
    } catch (e) {
      console.log('Push failed:', e)
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
        <TopBar totalPoints={totalPoints} />
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