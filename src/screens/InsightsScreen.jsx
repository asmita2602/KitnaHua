import { useState, useEffect } from 'react'
import { Brain, RefreshCw, TrendingUp, BookOpen, Dumbbell, Star, BarChart2 } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

function formatDate(dateStr) {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const DAY_TYPE_COLORS = {
  'Normal Day':        { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'High Pressure Day': { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  'Travel Day':        { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  'Weekend Day':       { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
}

function InsightCard({ icon: Icon, iconColor, title, children, bg = '#fff', border = '#e2e8f0' }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {Icon && <Icon size={17} color={iconColor || '#64748b'} />}
        <p style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

function ScoreBadge({ score }) {
  const rating =
    score >= 9 ? { label: 'Excellent Day', color: '#22c55e', bg: '#dcfce7' } :
    score >= 7 ? { label: 'Good Day',       color: '#3b82f6', bg: '#dbeafe' } :
    score >= 5 ? { label: 'Average Day',    color: '#f97316', bg: '#ffedd5' } :
                 { label: 'Poor Day',       color: '#ef4444', bg: '#fee2e2' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%',
        background: rating.bg, border: `3px solid ${rating.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ fontSize: '20px', fontWeight: '900', color: rating.color, fontFamily: 'Nunito, sans-serif' }}>
          {score.toFixed(1)}
        </p>
      </div>
      <div>
        <p style={{ fontSize: '16px', fontWeight: '800', color: rating.color, fontFamily: 'Nunito, sans-serif' }}>
          {rating.label}
        </p>
        <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'Nunito, sans-serif' }}>AI Score out of 10</p>
      </div>
    </div>
  )
}

function MiniHeatmap({ feedbackList }) {
  const days = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(localDateString(d))
  }
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {days.map(ds => {
        const rec = feedbackList.find(f => f.date === ds)
        // ✅ fixed: read from f.study.actualHours not f.studySessions
        const studyHrs = parseFloat(rec?.study?.actualHours) || 0
        const hasExercise = parseFloat(rec?.exercise?.actualDuration) > 0
        const color = studyHrs > 0 && hasExercise ? '#22c55e'
          : studyHrs > 0 ? '#3b82f6'
          : hasExercise ? '#f97316'
          : '#e2e8f0'
        return (
          <div key={ds} style={{ width: '16px', height: '16px', borderRadius: '4px', background: color }} />
        )
      })}
    </div>
  )
}

function computeLocalAnalysis(feedback, dayType) {
  if (!feedback) return null
  // ✅ fixed: read from feedback.study not feedback.studySessions
  const { study, office, exercise } = feedback
  const totalActualStudy = parseFloat(study?.actualHours) || 0

  let score = 5
  let reclassifiedType = dayType
  let reclassifyReason = null

  if (totalActualStudy >= 4)      score += 2
  else if (totalActualStudy >= 3) score += 1.5
  else if (totalActualStudy >= 2) score += 0.5
  else if (totalActualStudy >= 1) score -= 0.5
  else                            score -= 1.5

  if (exercise) {
    const planned = parseFloat(exercise.plannedDuration) || 0
    const actual  = parseFloat(exercise.actualDuration)  || 0
    const pct = planned > 0 ? (actual / planned) * 100 : 0
    if (pct >= 100)                  score += 1
    else if (pct >= 75)              score += 0.5
    else if (planned > 0 && pct < 50) score -= 0.5
  }

  if (office) {
    const meetings    = parseInt(office.meetingsCount) || 0
    const blockers    = (office.blockers || '').toLowerCase()
    const urgentWords = ['urgent', 'production', 'escalation', 'critical', 'emergency']
    const hasUrgent   = urgentWords.some(w => blockers.includes(w))
    if (meetings >= 5 || hasUrgent) {
      reclassifiedType  = 'High Pressure Day'
      reclassifyReason  = `${meetings >= 5 ? meetings + ' meetings' : ''} ${hasUrgent ? '+ urgent blockers' : ''}`.trim()
    }
  }

  score = Math.min(10, Math.max(1, score))

  const analysis = totalActualStudy >= 3
    ? 'Good study session today. Maintain this consistency.'
    : `Only ${totalActualStudy}h of study completed. Office workload likely impacted focus time.`

  const recommendation = (exercise && parseFloat(exercise.actualDuration) === 0)
    ? 'Prioritise even a short 20-min exercise session tomorrow morning.'
    : "Plan tomorrow's study blocks before office hours begin."

  return { score, reclassifiedType, reclassifyReason, analysis, recommendation, realityCheck: null }
}

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
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        }),
      }
    )
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

function parseGeminiJSON(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch { return null }
}

export default function InsightsScreen() {
  const today = localDateString()   // ✅ IST-safe
  const [todayFeedback, setTodayFeedback]   = useState(null)
  const [dayType, setDayType]               = useState('Normal Day')
  const [allFeedback, setAllFeedback]       = useState([])
  const [analysis, setAnalysis]             = useState(null)
  const [monthSummary, setMonthSummary]     = useState(null)
  const [loading, setLoading]               = useState(false)
  const [aiMode, setAiMode]                 = useState(false)
  const [subjectData, setSubjectData]       = useState([])
  const [totalPoints, setTotalPoints]       = useState(0)
  const [redeemedCount, setRedeemedCount]   = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const dayRec = await db.days.get(today)
    const dt = dayRec?.dayType || 'Normal Day'
    setDayType(dt)

    let feedback = null
    let allFb = []
    try {
      feedback = await db.feedback?.get?.(today)
      allFb    = await db.feedback?.toArray?.() || []
    } catch {}
    setTodayFeedback(feedback)
    setAllFeedback(allFb)

    // ✅ fixed: read f.study.subjects + f.study.actualHours
    const subjMap = {}
    allFb.forEach(f => {
      if (f.study?.subjects?.length && f.study?.actualHours) {
        const hrs = parseFloat(f.study.actualHours) || 0
        const perSubject = hrs / f.study.subjects.length
        f.study.subjects.forEach(subName => {
          subjMap[subName] = (subjMap[subName] || 0) + perSubject
        })
      }
    })
    setSubjectData(Object.entries(subjMap).sort((a, b) => b[1] - a[1]))

    // Points
    const allTasks = await db.tasks.toArray()
    const pts = allTasks
      .filter(t => t.completed && t.date !== 'template')
      .reduce((sum, t) => sum + (t.points || 0), 0)
    let redPts = 0, redCount = 0
    try {
      const reds = await db.redemptions?.toArray?.() || []
      redPts    = reds.reduce((s, r) => s + r.cost, 0)
      redCount  = reds.length
    } catch {}
    setTotalPoints(Math.max(0, pts - redPts))
    setRedeemedCount(redCount)

    buildMonthSummary(allFb)
    if (feedback) runAnalysis(feedback, dt, allFb)
  }

  async function runAnalysis(feedback, dt, allFb) {
    setLoading(true)
    const local = computeLocalAnalysis(feedback, dt)

    if (GEMINI_API_KEY) {
      const raw    = await callGemini(buildPrompt(feedback, dt, allFb))
      const parsed = raw ? parseGeminiJSON(raw) : null
      if (parsed) {
        setAnalysis({ ...parsed, _source: 'ai' })
        setAiMode(true)
        setLoading(false)
        return
      }
    }

    setAnalysis({ ...local, _source: 'local' })
    setAiMode(false)
    setLoading(false)
  }

  function buildPrompt(feedback, dt, allFb) {
    const recentDays = allFb.slice(-7)
    const totalStudy = feedback?.studySlots?.reduce((s, sess) => s + (parseFloat(sess.actualHours) || 0), 0) || 0
    const subjects = feedback?.studySlots?.map(s => `${s.subjectName}(${s.actualHours}h)`).filter(s => s).join(', ') || 'None'
    const topics = feedback?.studySlots?.map(s => s.topicNames?.join(', ') || s.topicName || '').filter(Boolean).join(', ') || 'None'
    const avgStudy = (recentDays.reduce((s, f) => s + (f.studySlots?.reduce((ss, sl) => ss + (parseFloat(sl.actualHours) || 0), 0) || f.study?.actualHours || 0), 0) / Math.max(recentDays.length, 1)).toFixed(1)

    return `You are a strict personal productivity coach for Asmita, a software developer at Accenture preparing for CIL Management Trainee (CS) government exam.

Today's detailed data:
- Day type (selected): ${dt}
- Study sessions: ${feedback?.studySlots?.length || 0} sessions, total ${totalStudy}h
- Subjects studied: ${subjects}
- Topics covered: ${topics}
- Office: ${feedback?.office?.actualHours || 0}h worked, ${feedback?.office?.meetingsCount || 0} meetings, work: ${feedback?.office?.workTypes?.join(', ') || 'N/A'}, blockers: "${feedback?.office?.blockers || 'None'}"
- Exercise: Planned ${feedback?.exercise?.plannedDuration || 0}h, Actual ${feedback?.exercise?.actualDuration || 0}h, type: ${feedback?.exercise?.exerciseType || 'N/A'}
- Overall satisfaction: ${feedback?.reflection?.overallSatisfaction || 0}/10
- Last 7 days avg study: ${avgStudy}h/day
- Today vs yesterday: ${totalStudy > parseFloat(avgStudy) ? 'Better than average' : 'Below average'}

Scoring rules (base 5):
- Study 4h+: +2, 3h: +1.5, 2h: +0.5, 1h: -0.5, 0h: -1.5
- Exercise 100%: +1, 75%: +0.5, <50%: -0.5
- High office load (5+ meetings or urgent blockers): note in analysis

Score breakdown required — show exactly what added/subtracted.
Reclassify to High Pressure if meetings>=5 or urgent/production/critical in blockers.
Address Asmita by name. Reference specific subjects. Be strict but encouraging.

Respond ONLY valid JSON:
{
  "score": 7.5,
  "scoreBreakdown": [
    "+1.5 for 3h study",
    "+0.5 for exercise completed",
    "-0.5 for skipping DSA revision"
  ],
  "reclassifiedType": "Normal Day",
  "reclassifyReason": null,
  "analysis": "Asmita, today you spent 3h on COA and completed normalization topic. Exercise was consistent. However DSA received no attention despite being exam critical.",
  "recommendation": "Tomorrow prioritize DSA for at least 1.5h before office hours. COA momentum is good — shift focus now.",
  "realityCheck": null
}`
  }

  function buildMonthSummary(allFb) {
    const now = new Date()
    const monthFb = allFb.filter(f => {
      const parts = f.date.split('-').map(Number)
      return parts[1] - 1 === now.getMonth() && parts[0] === now.getFullYear()
    })
    let actualStudy = 0, plannedEx = 0, actualEx = 0
    monthFb.forEach(f => {
      // ✅ fixed: read from f.study
      actualStudy += parseFloat(f?.study?.actualHours || 0)
      plannedEx   += parseFloat(f?.exercise?.plannedDuration || 0)
      actualEx    += parseFloat(f?.exercise?.actualDuration || 0)
    })
    const adherence = monthFb.length > 0
      ? Math.min(100, Math.round((actualStudy / Math.max(actualStudy, 1)) * 100))
      : 0
    setMonthSummary({
      adherence,
      actualStudy: actualStudy.toFixed(1),
      plannedEx:   plannedEx.toFixed(1),
      actualEx:    actualEx.toFixed(1),
      daysLogged:  monthFb.length,
    })
  }

  const selectedColors     = DAY_TYPE_COLORS[dayType]
  const reclassifiedColors = analysis?.reclassifiedType ? DAY_TYPE_COLORS[analysis.reclassifiedType] : null
  const showReclassification = analysis?.reclassifiedType && analysis.reclassifiedType !== dayType

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Nunito, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>AI Analysis</p>
          <p style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>Insights</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {aiMode && (
            <div style={{ background: '#ede9fe', border: '1px solid #a78bfa', borderRadius: '20px', padding: '4px 10px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#5b21b6' }}>✦ Gemini AI</p>
            </div>
          )}
          <button onClick={loadAll} style={{
            background: '#f1f5f9', border: 'none', borderRadius: '10px',
            width: '36px', height: '36px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={16} color='#64748b' />
          </button>
        </div>
      </div>

      {!todayFeedback ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>No feedback yet</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Submit today's feedback to see AI analysis</p>
        </div>
      ) : loading ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>🤖</p>
          <p style={{ fontSize: '14px', fontWeight: '700', color: '#64748b' }}>Analysing your day...</p>
        </div>
      ) : analysis ? (
        <>
          {/* Reclassification */}
          {showReclassification && (
            <InsightCard icon={Brain} iconColor='#8b5cf6' title="AI Day Reclassification">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: selectedColors.bg, border: `1px solid ${selectedColors.border}`, borderRadius: '8px', padding: '6px 12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '800', color: selectedColors.text }}>You: {dayType}</p>
                </div>
                <p style={{ fontSize: '16px', color: '#94a3b8' }}>→</p>
                <div style={{ background: reclassifiedColors.bg, border: `2px solid ${reclassifiedColors.border}`, borderRadius: '8px', padding: '6px 12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '800', color: reclassifiedColors.text }}>AI: {analysis.reclassifiedType}</p>
                </div>
              </div>
              {analysis.reclassifyReason && (
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '10px', lineHeight: '1.5' }}>
                  Reason: {analysis.reclassifyReason}
                </p>
              )}
            </InsightCard>
          )}

          {/* Score */}
         {/* Card 2: Score */}
          <InsightCard icon={Star} iconColor='#f59e0b' title="Today's Score">
            <ScoreBadge score={analysis.score || 5} />
            {analysis.scoreBreakdown && analysis.scoreBreakdown.length > 0 && (
              <div style={{ marginTop: '12px', background: '#f8fafc', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>Score Breakdown:</p>
                {analysis.scoreBreakdown.map((item, i) => (
                  <p key={i} style={{
                    fontSize: '12px', fontWeight: '600', fontFamily: 'Nunito, sans-serif',
                    color: item.startsWith('+') ? '#22c55e' : item.startsWith('-') ? '#ef4444' : '#64748b',
                    marginBottom: '3px',
                  }}>
                    {item}
                  </p>
                ))}
              </div>
            )}
          </InsightCard>

          {/* Analysis */}
          <InsightCard icon={TrendingUp} iconColor='#3b82f6' title="Daily Analysis">
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', fontWeight: '600' }}>
              {analysis.analysis}
            </p>
          </InsightCard>

          {/* Reality Check */}
          {analysis.realityCheck && (
            <InsightCard icon={Brain} iconColor='#ef4444' title="Reality Check" bg='#fff5f5' border='#fecaca'>
              <p style={{ fontSize: '14px', color: '#dc2626', lineHeight: '1.6', fontWeight: '600' }}>
                {analysis.realityCheck}
              </p>
            </InsightCard>
          )}

          {/* Recommendation */}
          <InsightCard icon={Brain} iconColor='#22c55e' title="AI Recommendation" bg='#f0fdf4' border='#bbf7d0'>
            <p style={{ fontSize: '14px', color: '#15803d', lineHeight: '1.6', fontWeight: '600' }}>
              {analysis.recommendation}
            </p>
          </InsightCard>

          {/* Subject Analysis */}
          {subjectData.length > 0 && (
            <InsightCard icon={BookOpen} iconColor='#3b82f6' title="Subject Analysis">
              {subjectData.map(([subject, hrs]) => (
                <div key={subject} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{subject}</p>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6' }}>{hrs.toFixed(1)} hrs</p>
                </div>
              ))}
            </InsightCard>
          )}

          {/* Heatmap */}
          <InsightCard icon={Dumbbell} iconColor='#22c55e' title="Streak Analysis">
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>Last 28 days</p>
            <MiniHeatmap feedbackList={allFeedback} />
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                { color: '#22c55e', label: 'Study + Exercise' },
                { color: '#3b82f6', label: 'Study only' },
                { color: '#f97316', label: 'Exercise only' },
                { color: '#e2e8f0', label: 'Missed' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                  <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>{l.label}</p>
                </div>
              ))}
            </div>
          </InsightCard>

          {/* Monthly Summary */}
          {monthSummary && (
            <InsightCard icon={BarChart2} iconColor='#8b5cf6' title="Monthly Summary">
              <div style={{
                background: '#f8fafc', borderRadius: '12px', padding: '14px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              }}>
                {[
                  { label: 'Days Logged',       value: monthSummary.daysLogged },
                  { label: 'Adherence',          value: `${monthSummary.adherence}%` },
                  { label: 'Study Hours',        value: `${monthSummary.actualStudy}h` },
                  { label: 'Exercise Planned',   value: `${monthSummary.plannedEx}h` },
                  { label: 'Exercise Done',      value: `${monthSummary.actualEx}h` },
                  { label: 'Total Points',       value: totalPoints.toLocaleString() },
                  { label: 'Rewards Redeemed',   value: redeemedCount },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>{item.label}</p>
                    <p style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          {/* Monthly Review */}
          <InsightCard icon={Brain} iconColor='#8b5cf6' title="Monthly Review">
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', fontWeight: '600' }}>
              {monthSummary?.adherence >= 80
                ? 'Strong overall adherence this month. Keep the momentum going.'
                : 'Study execution dropped on high-pressure workdays. Plan buffer time for office-heavy days.'}
            </p>
          </InsightCard>
        </>
      ) : null}
    </div>
  )
}