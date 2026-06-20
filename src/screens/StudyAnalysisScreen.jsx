import { useState, useEffect } from 'react'
import { BookOpen, TrendingUp, Clock, BarChart2, Brain } from 'lucide-react'
import { db } from '../db'
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'

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
  const [subjects,     setSubjects]     = useState([])
  const [subjectHours, setSubjectHours] = useState({})
  const [activityData, setActivityData] = useState({ watched: 0, notesMade: 0, questionsSolved: 0, revisionDone: 0 })
  const [ranking,      setRanking]      = useState([])
  const [top5,         setTop5]         = useState([])
  const [aiCoach,      setAiCoach]      = useState('')
  const [aiLoading,    setAiLoading]    = useState(false)
  const [loaded,       setLoaded]       = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const subs        = await db.subjects.toArray()
    const allFeedback = await db.feedback?.toArray?.() || []
    const allLectures = await db.lectures.toArray()

    // ✅ fixed: read from f.study.subjects + f.study.actualHours
    const hoursMap = {}
    allFeedback.forEach(f => {
      if (f.study?.subjects?.length && f.study?.actualHours) {
        const hrs        = parseFloat(f.study.actualHours) || 0
        const perSubject = hrs / f.study.subjects.length
        f.study.subjects.forEach(subName => {
          hoursMap[subName] = (hoursMap[subName] || 0) + perSubject
        })
      }
    })
    setSubjectHours(hoursMap)

    // Activity from lectures
    const activity = { watched: 0, notesMade: 0, questionsSolved: 0, revisionDone: 0 }
    allLectures.forEach(l => {
      if (l.watched)          activity.watched++
      if (l.notesMade)        activity.notesMade++
      if (l.questionsSolved)  activity.questionsSolved++
      if (l.revisionDone)     activity.revisionDone++
    })
    setActivityData(activity)

    // Subject completion
    const subjectData = []
    for (const sub of subs) {
      const topics = await db.topics.where('subjectId').equals(sub.id).toArray()
      let totalLectures = 0, completedLectures = 0, notesMade = 0, questionsSolved = 0, revisionDone = 0
      for (const topic of topics) {
        const lectures = await db.lectures.where('topicId').equals(topic.id).toArray()
        totalLectures     += lectures.length
        completedLectures += lectures.filter(l => l.watched).length
        notesMade         += lectures.filter(l => l.notesMade).length
        questionsSolved   += lectures.filter(l => l.questionsSolved).length
        revisionDone      += lectures.filter(l => l.revisionDone).length
      }
      const completion = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0
      const hours      = hoursMap[sub.name] || 0
      const rankScore  = (completion * 0.4) + (hours * 3 * 0.3) + (questionsSolved * 0.2) + (revisionDone * 0.1)
      subjectData.push({ ...sub, totalLectures, completedLectures, completion, hours, notesMade, questionsSolved, revisionDone, rankScore })
    }

    setSubjects(subjectData)
    setRanking([...subjectData].sort((a, b) => b.rankScore - a.rankScore))
    setTop5([...subjectData].sort((a, b) => b.hours - a.hours).slice(0, 5))
    setLoaded(true)

    if (subjectData.length > 0) loadAiCoach(subjectData)
  }

  async function loadAiCoach(subjectData) {
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

    if (GEMINI_API_KEY) {
      const response = await callGemini(prompt)
      if (response) { setAiCoach(response); setAiLoading(false); return }
    }

    // Fallback rule engine
    const sorted   = [...subjectData].sort((a, b) => a.completion - b.completion)
    const weakest  = sorted[0]
    const strongest = sorted[sorted.length - 1]
    const lowHours = subjectData.filter(s => s.hours < 1)
    let msg = ''
    if (weakest && strongest && weakest.name !== strongest.name) {
      msg += `${strongest.name} is your strongest subject at ${strongest.completion}% completion. `
      msg += `${weakest.name} needs urgent attention — only ${weakest.completion}% done. `
    }
    if (lowHours.length > 0) {
      msg += `${lowHours.map(s => s.name).join(', ')} ${lowHours.length === 1 ? 'has' : 'have'} less than 1 hour of study. `
    }
    msg += 'Focus on revision and solving questions — not just watching lectures.'
    setAiCoach(msg)
    setAiLoading(false)
  }

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
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📚</p>
          <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>No subjects yet</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Add subjects from the Subjects screen first</p>
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
          { label: 'Lectures Watched',  value: activityData.watched,         color: '#3b82f6' },
          { label: 'Notes Made',        value: activityData.notesMade,        color: '#8b5cf6' },
          { label: 'Questions Solved',  value: activityData.questionsSolved,  color: '#f97316' },
          { label: 'Revision Done',     value: activityData.revisionDone,     color: '#22c55e' },
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
        <SectionHeader icon={BookOpen} iconColor='#3b82f6' title="Subject-wise Activity" />
        {subjects.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>No subjects yet.</p>
        ) : subjects.map(sub => (
          <div key={sub.id} style={{
            background: '#f8fafc', borderRadius: '12px', padding: '12px',
            marginBottom: '10px', border: '1px solid #e2e8f0',
          }}>
            <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
              {sub.name}
            </p>
            {[
              { label: '👁 Watched', value: sub.completedLectures, color: '#3b82f6' },
              { label: '📝 Notes', value: sub.notesMade, color: '#8b5cf6' },
              { label: '❓ Questions', value: sub.questionsSolved, color: '#f97316' },
              { label: '🔄 Revision', value: sub.revisionDone, color: '#22c55e' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{item.label}</p>
                <p style={{ fontSize: '13px', fontWeight: '800', color: item.color }}>{item.value}</p>
              </div>
            ))}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Completion</p>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>{sub.completion}%</p>
              </div>
              <ProgressBar value={sub.completion} color={sub.completion >= 80 ? '#22c55e' : sub.completion >= 50 ? '#3b82f6' : '#f97316'} />
            </div>
          </div>
        ))}
      </Card>

      {/* Section 4 — Top 5 Most Studied */}
      <Card>
        <SectionHeader icon={Clock} iconColor='#22c55e' title="Top 5 Most Studied" />
        {top5.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            No study hours recorded yet. Submit feedback with subjects studied.
          </p>
        ) : (
          <>
            {top5.map((sub, idx) => (
              <div key={sub.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 0', borderBottom: idx < top5.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <p style={{ fontSize: '13px', fontWeight: '800', color: '#94a3b8', minWidth: '20px' }}>
                  #{idx + 1}
                </p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', flex: 1 }}>{sub.name}</p>
                <p style={{ fontSize: '14px', fontWeight: '800', color: '#22c55e' }}>
                  {sub.hours.toFixed(1)} hrs
                </p>
              </div>
            ))}
            <div style={{ marginTop: '14px' }}>
              {top5.map((sub, idx) => {
                const maxH = Math.max(...top5.map(s => s.hours), 1)
                return (
                  <div key={sub.id} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{sub.name}</p>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                        {Math.round((sub.hours / maxH) * 100)}%
                      </p>
                    </div>
                    <ProgressBar
                      value={(sub.hours / maxH) * 100}
                      color={['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444'][idx]}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {/* Section 5 — AI Study Coach */}
      <Card style={{ background: '#0f172a', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Brain size={17} color='#38bdf8' />
          <p style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>AI Study Coach</p>
          {!!import.meta.env.VITE_GEMINI_API_KEY && (
            <div style={{ background: '#1e293b', borderRadius: '20px', padding: '3px 8px', marginLeft: 'auto' }}>
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