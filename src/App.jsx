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
import CloudSync from './components/CloudSync'

export default function App() {
  const [totalPoints, setTotalPoints] = useState(0)

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

  useEffect(() => { refreshPoints() }, [])

  return (
    <CloudSync>
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
              <Route path="/" element={<HomeScreen onPointsUpdate={refreshPoints} />} />
              <Route path="/calendar" element={<CalendarScreen />} />
              <Route path="/templates" element={<TemplatesScreen />} />
              <Route path="/feedback" element={<FeedbackScreen />} />
              <Route path="/rewards" element={<RewardsScreen />} />
              <Route path="/insights" element={<InsightsScreen />} />
              <Route path="/subjects" element={<SubjectsScreen />} />
              <Route path="/study-analysis" element={<StudyAnalysisScreen />} />
            </Routes>
          </div>
          <BottomNav />
        </div>
      </BrowserRouter>
    </CloudSync>
  )
}