import { useState, useEffect } from 'react'
import { BookOpen, TrendingUp, Award, Clock, BarChart2, Brain } from 'lucide-react'
import { db } from '../db'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-1.5-flash'

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    )
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

function SectionHeader({ icon: Icon, iconColor, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <Icon size={17} color={iconColor} />
      <p style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
        {title}
      </p>
    </div>
  )
}

function ProgressBar({ value, color = '#3b82f6' }) {
  return (
    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '20px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: '20px',
        width: `${Math.min(value, 100)}%`,
        background: color, transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: '16px', padding: '16px', marginBottom: '14px',
      ...style,
    }}>
      {children}
    </div>
  )
}

export default function StudyAnalysisScreen() {
  const [subjects, setSubjects] = useState([])
  const [subjectHours, setSubjectHours] = useState({})
  const [activityData, setActivityData] = useState({ watched: 0, notesMade: 0, questionsSolved: 0, revisionDone: 0 })
  const [ranking, setRanking] = useState([])
  const [top5, setTop5] = useState([])
  const [aiCoach, setAiCoach] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const subs = await db.subjects.toArray()
    const allFeedback = await db.feedback?.toArray?.() || []
    const allLectures = await db.lectures.toArray()

    // Subject hours from feedback
    const hoursMap = {}
    allFeedback.forEach(f => {
      f.studySessions?.forEach(sess => {
        if (sess.subjectName) {
          hoursMap[sess.subjectName] = (hoursMap[sess.subjectName] || 0) + (parseFloat(sess.actualHours) || 0)
        }
      })
    })
    setSubjectHours(hoursMap)

    // Activity data from lectures
    const activity = { watched: 0, notesMade: 0, questionsSolved: 0, revisionDone: 0 }
    allLectures.forEach(l => {
      if (l.watched) activity.watched++
      if (l.notesMade) activity.notesMade++
      if (l.questionsSolved) activity.questionsSolved++
      if (l.revisionDone) activity.revisionDone++
    })
    setActivityData(activity)

    // Subject completion data
    const subjectData = []
    for (const sub of subs) {
      const topics = await db.topics.where('subjectId').equals(sub.id).toArray()
      let totalLectures = 0, completedLectures = 0, notesMade = 0, questionsSolved = 0, revisionDone = 0
      for (const topic of topics) {
        const lectures = await db.lectures.where('topicId').equals(topic.id).toArray()
        totalLectures += lectures.length
        completedLectures += lectures.filter(l => l.watched).length
        notesMade += lectures.filter(l => l.notesMade).length
        questionsSolved += lectures.filter(l => l.questionsSolved).length
        revisionDone += lectures.filter(l => l.revisionDone).length
      }
      const completion = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0
      const hours = hoursMap[sub.name] || 0
      const rankScore = (completion * 0.4) + (hours * 3 * 0.3) + (questionsSolved * 0.2) + (revisionDone * 0.1)
      subjectData.push({ ...sub, totalLectures, completedLectures, completion, hours, notesMade, questionsSolved, revisionDone, rankScore })
    }

    setSubjects(subjectData)

    // Ranking
    const ranked = [...subjectData].sort((a, b) => b.rankScore - a.rankScore)
    setRanking(ranked)

    // Top 5 by hours
    const top = [...subjectData].sort((a, b) => b.hours - a.hours).slice(0, 5)
    setTop5(top)

    setLoaded(true)

    // AI Coach
    if (GEMINI_API_KEY && subjectData.length > 0) {
      loadAiCoach(subjectData, hoursMap)
    }
  }

  async function loadAiCoach(subjectData, hoursMap) {
    setAiLoading(true)
    const subSummary = subjectData.map(s =>
      `${s.name}: ${s.completion}% complete, ${s.hours.toFixed(1)}h studied, ${s.questionsSolved} questions solved`
    ).join('\n')

    const prompt = `You are a strict study coach for Asmita preparing for a government exam (CIL MT CS).

Subject data:
${subSummary}

Give a 3-4 line honest assessment:
- Which subjects are progressing well
- Which need more attention
- One specific actionable advice for this week
- Be strict but not demotivating

Keep it concise, no bullet points, plain text only.`

    const response = await callGemini(prompt)
    if (response) setAiCoach(response)
    else setAiCoach('Complete more lectures and study sessions to get personalized AI coaching advice.')
    setAiLoading(false)
  }

  const maxHours = Math.max(...Object.values(subjectHours), 1)
  const maxActivity = Math.max(activityData.watched, activityData.notesMade, activityData.questionsSolved, activityData.revisionDone, 1)

  if (!loaded) {
    return (
      <div style={{ padding: '16px', fontFamily: 'Nunito, sans-serif', textAlign: 'center', paddingTop: '40px' }}>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading analysis...</p>
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div style={{ padding: '16px', fontFamily: 'Nunito, sans-serif' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Analytics</p>
        <p style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>Study Analysis</p>
        <div style={{
          background: '#fff', borderRadius: '16px', padding: '32px',
          textAlign: 'center', border: '1px solid #e2e8f0',
        }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📚</p>
          <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>No subjects yet</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            Add subjects from the Subjects screen first
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Nunito, sans-serif' }}>

      <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Analytics</p>
      <p style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>Study Analysis</p>

      {/* Section 1 — Subject Completion */}
      <Card>
        <SectionHeader icon={BookOpen} iconColor='#3b82f6' title="Subject Completion" />
        {subjects.map(sub => (
          <div key={sub.id} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{sub.name}</p>
              <p style={{ fontSize: '13px', fontWeight: '800', color: '#3b82f6' }}>{sub.completion}%</p>
            </div>
            <ProgressBar
              value={sub.completion}
              color={sub.completion >= 80 ? '#22c55e' : sub.completion >= 50 ? '#3b82f6' : '#f97316'}
            />
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', fontWeight: '600' }}>
              {sub.completedLectures}/{sub.totalLectures} lectures
            </p>
          </div>
        ))}
      </Card>

      {/* Section 2 — Learning Activity */}
      <Card>
        <SectionHeader icon={BarChart2} iconColor='#8b5cf6' title="Learning Activity" />
        {[
          { label: 'Lectures Watched', value: activityData.watched, color: '#3b82f6' },
          { label: 'Notes Made', value: activityData.notesMade, color: '#8b5cf6' },
          { label: 'Questions Solved', value: activityData.questionsSolved, color: '#f97316' },
          { label: 'Revision Done', value: activityData.revisionDone, color: '#22c55e' },
        ].map(item => (
          <div key={item.label} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{item.label}</p>
              <p style={{ fontSize: '13px', fontWeight: '800', color: item.color }}>{item.value}</p>
            </div>
            <ProgressBar value={(item.value / maxActivity) * 100} color={item.color} />
          </div>
        ))}
      </Card>

      {/* Section 3 — Subject Ranking */}
      <Card>
        <SectionHeader icon={Award} iconColor='#f59e0b' title="Subject Ranking" />
        {ranking.map((sub, idx) => (
          <div key={sub.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 0', borderBottom: idx < ranking.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: idx === 0 ? '#fef9c3' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#ffedd5' : '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <p style={{
                fontSize: '13px', fontWeight: '900',
                color: idx === 0 ? '#854d0e' : idx === 1 ? '#475569' : idx === 2 ? '#9a3412' : '#94a3b8',
              }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{sub.name}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                {sub.completion}% complete · {sub.hours.toFixed(1)}h studied
              </p>
            </div>
          </div>
        ))}
      </Card>

      {/* Section 4 — Top 5 Most Studied */}
      <Card>
        <SectionHeader icon={Clock} iconColor='#22c55e' title="Top 5 Most Studied" />
        {top5.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>No study hours recorded yet.</p>
        ) : top5.map((sub, idx) => (
          <div key={sub.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '8px 0', borderBottom: idx < top5.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}>
            <p style={{ fontSize: '13px', fontWeight: '800', color: '#94a3b8', minWidth: '20px' }}>
              #{idx + 1}
            </p>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{sub.name}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#22c55e' }}>
                {sub.hours.toFixed(1)} hrs
              </p>
            </div>
          </div>
        ))}
        {top5.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            {top5.map((sub, idx) => (
              <div key={sub.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{sub.name}</p>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                    {Math.round((sub.hours / Math.max(...top5.map(s => s.hours), 1)) * 100)}%
                  </p>
                </div>
                <ProgressBar
                  value={(sub.hours / Math.max(...top5.map(s => s.hours), 1)) * 100}
                  color={['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444'][idx]}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Section 5 — AI Study Coach */}
      <Card style={{ background: '#0f172a', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Brain size={17} color='#38bdf8' />
          <p style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>AI Study Coach</p>
          {GEMINI_API_KEY && (
            <div style={{
              background: '#1e293b', borderRadius: '20px', padding: '3px 8px', marginLeft: 'auto',
            }}>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#38bdf8' }}>✦ Gemini</p>
            </div>
          )}
        </div>
        {aiLoading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Analysing your study pattern...</p>
        ) : (
          <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.7', fontWeight: '600' }}>
            {aiCoach || 'Add subjects and study sessions to get personalized coaching.'}
          </p>
        )}
      </Card>

    </div>
  )
}