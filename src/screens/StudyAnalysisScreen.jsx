import { useState, useEffect } from 'react'
import { Brain, RefreshCw, Trophy, BarChart2, BookOpen, Clock, TrendingUp } from 'lucide-react'
import { db } from '../db'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ProgressBar({ value, color = '#3b82f6', height = 8 }) {
  return (
    <div style={{ height, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  )
}

function SectionCard({ icon: Icon, iconColor, title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        {Icon && <Icon size={18} color={iconColor || '#64748b'} />}
        <p style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 600 } }) }
    )
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudyAnalysisScreen() {
  const [subjects, setSubjects] = useState([])
  const [activityData, setActivityData] = useState({ watched: 0, notes: 0, questions: 0, revision: 0 })
  const [topStudied, setTopStudied] = useState([])
  const [subjectRanking, setSubjectRanking] = useState([])
  const [pieData, setPieData] = useState([])
  const [aiCoach, setAiCoach] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // Load subjects with full lecture stats
      const subs = await db.subjects.toArray()
      const result = []
      let totalWatched = 0, totalNotes = 0, totalQ = 0, totalRev = 0

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
        totalWatched += completedLectures
        totalNotes += notesMade
        totalQ += questionsSolved
        totalRev += revisionDone
        result.push({ ...sub, totalLectures, completedLectures, notesMade, questionsSolved, revisionDone, topicsCount: topics.length, progress: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0 })
      }
      setSubjects(result)
      setActivityData({ watched: totalWatched, notes: totalNotes, questions: totalQ, revision: totalRev })

      // Study hours from feedback
      let allFb = []
      try { allFb = await db.feedback?.toArray?.() || [] } catch {}

      const studyHoursMap = {}
      allFb.forEach(f => {
        if (f.study?.subjects?.length && f.study?.actualHours) {
          const hrs = parseFloat(f.study.actualHours) || 0
          const perSubject = hrs / f.study.subjects.length
          f.study.subjects.forEach(s => { studyHoursMap[s] = (studyHoursMap[s] || 0) + perSubject })
        }
      })

      // Top 5 studied (by hours from feedback)
      const top5 = Object.entries(studyHoursMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      setTopStudied(top5)

      // Pie data from feedback hours (all subjects)
      const total = Object.values(studyHoursMap).reduce((s, v) => s + v, 0)
      const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#38bdf8', '#f59e0b', '#ec4899']
      const pie = Object.entries(studyHoursMap).map(([name, hrs], i) => ({
        name, hrs: hrs.toFixed(1), pct: total > 0 ? Math.round((hrs / total) * 100) : 0, color: PIE_COLORS[i % PIE_COLORS.length]
      })).sort((a, b) => b.pct - a.pct)
      setPieData(pie)

      // Subject ranking formula: 40% completion + 30% study hours + 20% questions + 10% revision
      const maxHrs = Math.max(...result.map(s => {
        const hrs = studyHoursMap[s.name] || 0
        return hrs
      }), 1)
      const ranked = result.map(sub => {
        const hrs = studyHoursMap[sub.name] || 0
        const qScore = sub.totalLectures > 0 ? (sub.questionsSolved / sub.totalLectures) * 100 : 0
        const revScore = sub.totalLectures > 0 ? (sub.revisionDone / sub.totalLectures) * 100 : 0
        const score = (sub.progress * 0.4) + ((hrs / maxHrs) * 100 * 0.3) + (qScore * 0.2) + (revScore * 0.1)
        return { ...sub, score: Math.round(score), studyHours: hrs.toFixed(1) }
      }).sort((a, b) => b.score - a.score)
      setSubjectRanking(ranked)

      // AI Coach
      if (result.length > 0) runAICoach(result, studyHoursMap, allFb)
    } catch {}
    setLoading(false)
  }

  async function runAICoach(subjects, hoursMap, feedback) {
    setAiLoading(true)
    const subjectSummary = subjects.map(s => `${s.name}: ${s.progress}% complete, ${(hoursMap[s.name] || 0).toFixed(1)}h studied, ${s.questionsSolved} questions solved`).join('\n')

    if (GEMINI_API_KEY) {
      const prompt = `You are a strict study coach for Asmita preparing for government exams.

Subject summary:
${subjectSummary}

Analyze the subject balance, progress, and study hours. Give a strict but fair 3-4 line coaching message. Point out which subject is being neglected. Suggest specific action. Do not praise unnecessarily. Be direct.`
      const response = await callGemini(prompt)
      if (response) { setAiCoach(response.trim()); setAiLoading(false); return }
    }

    // Fallback rule engine
    const weakest = subjects.sort((a, b) => a.progress - b.progress)[0]
    const strongest = subjects.sort((a, b) => b.progress - a.progress)[0]
    const lowHours = subjects.filter(s => (hoursMap[s.name] || 0) < 2)
    let msg = ''
    if (weakest && strongest && weakest.name !== strongest.name) {
      msg += `${strongest.name} is your strongest subject at ${strongest.progress}% completion. `
      msg += `${weakest.name} needs urgent attention — only ${weakest.progress}% done. `
    }
    if (lowHours.length > 0) {
      msg += `${lowHours.map(s => s.name).join(', ')} ${lowHours.length === 1 ? 'is' : 'are'} receiving very little study time. `
    }
    msg += `Focus on revision and question-solving across all subjects — not just watching lectures.`
    setAiCoach(msg)
    setAiLoading(false)
  }

  // Donut chart SVG
  function DonutChart({ data }) {
    const size = 160, cx = 80, cy = 80, r = 62, stroke = 22
    const circumference = 2 * Math.PI * r
    let offset = 0
    const slices = data.map(d => {
      const dash = (d.pct / 100) * circumference
      const slice = { ...d, dash, offset: circumference - offset }
      offset += dash
      return slice
    })
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={s.offset} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '20px', fontWeight: '900', fill: '#0f172a', fontFamily: 'Nunito' }}>{data.length}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: '10px', fontWeight: '700', fill: '#94a3b8', fontFamily: 'Nunito' }}>subjects</text>
      </svg>
    )
  }

  const maxActivity = Math.max(activityData.watched, activityData.notes, activityData.questions, activityData.revision, 1)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
      <p style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>Loading analysis...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Nunito, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '20px 16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', marginBottom: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>Analytics</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>Study Analysis</p>
          <button onClick={loadAll} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={16} color='#94a3b8' />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '32px' }}>

        {subjects.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', border: '1px solid #e2e8f0', marginTop: '8px' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
            <p style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>No data yet</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Add subjects and start studying to see analysis</p>
          </div>
        ) : (
          <>
            {/* Section 1: Subject Completion */}
            <SectionCard icon={BookOpen} iconColor='#3b82f6' title="Subject Completion">
              {subjects.map(sub => (
                <div key={sub.id} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{sub.name}</p>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: sub.progress >= 80 ? '#16a34a' : sub.progress >= 50 ? '#2563eb' : '#ea580c' }}>{sub.progress}%</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ProgressBar value={sub.progress}
                      color={sub.progress >= 80 ? '#22c55e' : sub.progress >= 50 ? '#3b82f6' : sub.progress >= 30 ? '#f97316' : '#cbd5e1'} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {sub.completedLectures}/{sub.totalLectures}
                    </span>
                  </div>
                </div>
              ))}
            </SectionCard>

            {/* Section 2: Learning Activity */}
            <SectionCard icon={BarChart2} iconColor='#8b5cf6' title="Learning Activity">
              {[
                { label: 'Lectures Watched', value: activityData.watched, color: '#3b82f6' },
                { label: 'Notes Made', value: activityData.notes, color: '#8b5cf6' },
                { label: 'Questions Solved', value: activityData.questions, color: '#f97316' },
                { label: 'Revisions Done', value: activityData.revision, color: '#22c55e' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>{item.label}</p>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: item.color }}>{item.value}</span>
                  </div>
                  <ProgressBar value={(item.value / maxActivity) * 100} color={item.color} height={10} />
                </div>
              ))}
            </SectionCard>

            {/* Section 3: Subject Ranking */}
            <SectionCard icon={Trophy} iconColor='#f59e0b' title="Subject Ranking">
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
                Score = 40% completion + 30% study hours + 20% questions + 10% revision
              </p>
              {subjectRanking.map((sub, idx) => (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: idx === 0 ? '#fef9c3' : idx === 1 ? '#f1f5f9' : '#fff', borderRadius: '12px', marginBottom: '8px', border: idx === 0 ? '1px solid #fde047' : '1px solid #e2e8f0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c2c' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: '900', color: idx < 3 ? '#fff' : '#64748b' }}>#{idx + 1}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>{sub.name}</p>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>{sub.progress}% done · {sub.studyHours}h studied · {sub.questionsSolved} Q solved</p>
                  </div>
                  <div style={{ background: '#fff', borderRadius: '10px', padding: '4px 10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a' }}>{sub.score}</span>
                  </div>
                </div>
              ))}
            </SectionCard>

            {/* Section 4: Top 5 Most Studied */}
            {topStudied.length > 0 && (
              <SectionCard icon={Clock} iconColor='#22c55e' title="Top 5 Most Studied">
                {topStudied.map(([name, hrs], idx) => {
                  const max = topStudied[0][1]
                  const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444']
                  return (
                    <div key={name} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: COLORS[idx], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900', color: '#fff' }}>{idx + 1}</span>
                          <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{name}</p>
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: '900', color: COLORS[idx] }}>{hrs.toFixed(1)}h</p>
                      </div>
                      <ProgressBar value={(hrs / max) * 100} color={COLORS[idx]} height={7} />
                    </div>
                  )
                })}
              </SectionCard>
            )}

            {/* Section 5: Subject-wise Hours (Pie / Donut) */}
            {pieData.length > 0 && (
              <SectionCard icon={TrendingUp} iconColor='#f97316' title="Study Hours Distribution">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flexShrink: 0 }}>
                    <DonutChart data={pieData} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color, flexShrink: 0 }} />
                        <p style={{ fontSize: '12px', fontWeight: '700', color: '#475569', flex: 1 }}>{d.name}</p>
                        <p style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>{d.pct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Section 6: AI Study Coach */}
            <div style={{ background: '#0f172a', borderRadius: '20px', padding: '18px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Brain size={18} color='#38bdf8' />
                <p style={{ fontSize: '15px', fontWeight: '900', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>AI Study Coach</p>
                {GEMINI_API_KEY && (
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#38bdf8', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '20px', padding: '2px 8px', marginLeft: 'auto' }}>Gemini AI</span>
                )}
              </div>
              {aiLoading ? (
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', fontFamily: 'Nunito, sans-serif' }}>Analysing your study patterns...</p>
              ) : (
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', lineHeight: '1.7', fontFamily: 'Nunito, sans-serif' }}>{aiCoach}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )

  function DonutChart({ data }) {
    const size = 160, cx = 80, cy = 80, r = 62, stroke = 22
    const circumference = 2 * Math.PI * r
    let cumulativePct = 0
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {data.map((d, i) => {
          const dash = (d.pct / 100) * circumference
          const currentOffset = circumference * (1 - cumulativePct / 100)
          cumulativePct += d.pct
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={currentOffset}
              transform={`rotate(-90 ${cx} ${cy})`} />
          )
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: '20px', fontWeight: '900', fill: '#0f172a', fontFamily: 'Nunito' }}>{data.length}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: '10px', fontWeight: '700', fill: '#94a3b8', fontFamily: 'Nunito' }}>subjects</text>
      </svg>
    )
  }
}
