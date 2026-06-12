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
import { initApp, autoBackup, exportData, importData } from './sync'

export default function App() {
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { startApp() }, [])

  async function startApp() {
    setLoading(true)
    await initApp()
    await refreshPoints()
    setLoading(false)
  }

async function refreshPoints() {
    try {
      const allTasks = await db.tasks.toArray()
      // Only count completed tasks that are NOT template records
      // Template completions have fromTemplateId set
      // Avoid double counting: if fromTemplateId is set, count it once
      const seenTemplateIds = new Set()
      let pts = 0
      for (const t of allTasks) {
        if (!t.completed || t.date === 'template') continue
        if (t.fromTemplateId != null) {
          if (seenTemplateIds.has(t.fromTemplateId)) continue
          seenTemplateIds.add(t.fromTemplateId)
        }
        pts += Number(t.points) || 0
      }

    const reds = await db.redemptions?.toArray?.() || []
      const redPts = reds.reduce((s, r) => s + (Number(r.cost) || 0), 0)
      setTotalPoints(Math.max(0, pts - redPts))
    } catch {}
  }

  async function handleDataChange() {
    await refreshPoints()
    autoBackup()
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f8fafc',
        fontFamily: 'Nunito, sans-serif', flexDirection: 'column', gap: '12px',
      }}>
        <p style={{ fontSize: '28px', fontWeight: '900', color: '#38bdf8' }}>KitnaHua</p>
        <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '600' }}>Loading...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div style={{
        maxWidth: '414px', margin: '0 auto', minHeight: '100vh',
        background: '#f8fafc', position: 'relative', display: 'flex', flexDirection: 'column',
      }}>
        <TopBar totalPoints={totalPoints} onExport={exportData} onImport={importData} />
        <div style={{ flex: 1, paddingBottom: '70px' }}>
          <Routes>
            <Route path="/"               element={<HomeScreen       onPointsUpdate={handleDataChange} />} />
            <Route path="/calendar"       element={<CalendarScreen   onSave={handleDataChange} />} />
            <Route path="/templates"      element={<TemplatesScreen  onSave={handleDataChange} />} />
            <Route path="/feedback"       element={<FeedbackScreen   onSave={handleDataChange} />} />
            <Route path="/rewards"        element={<RewardsScreen    onRedeem={handleDataChange} />} />
            <Route path="/insights"       element={<InsightsScreen />} />
            <Route path="/subjects"       element={<SubjectsScreen   onSave={handleDataChange} />} />
            <Route path="/study-analysis" element={<StudyAnalysisScreen />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}