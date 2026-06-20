import { useState, useEffect } from 'react'
import { Brain, RefreshCw, TrendingUp, BookOpen, Dumbbell, Star, BarChart2 } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

function formatDate(dateStr) {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const DAY_TYPE_CSS = {
  'Normal Day':        { bg: 'oklch(85% .13 95 / .15)',  text: 'var(--day-normal)',   border: 'var(--day-normal)' },
  'High Pressure Day': { bg: 'oklch(78% .16 50 / .15)',  text: 'var(--day-pressure)', border: 'var(--day-pressure)' },
  'Travel Day':        { bg: 'oklch(74% .15 310 / .15)', text: 'var(--day-travel)',   border: 'var(--day-travel)' },
  'Weekend Day':       { bg: 'oklch(82% .14 155 / .15)', text: 'var(--day-weekend)',  border: 'var(--day-weekend)' },
}

function InsightCard({ icon: Icon, iconColor, title, children, bg, border }) {
  return (
    <div style={{ background: bg || 'var(--surface)', border: `1px solid ${border || 'var(--border)'}`, borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {Icon && <Icon size={17} color={iconColor || 'var(--muted-fg)'} />}
        <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>{title}</p>
      </div>
      {children}
    </div>
  )
}

function ScoreBadge({ score }) {
  const rating =
    score >= 9 ? { label: 'Excellent Day', color: 'oklch(65% .16 155)', bg: 'oklch(65% .16 155 / .15)' } :
    score >= 7 ? { label: 'Good Day',       color: 'oklch(65% .18 240)', bg: 'oklch(65% .18 240 / .15)' } :
    score >= 5 ? { label: 'Average Day',    color: 'var(--day-pressure)',bg: 'oklch(78% .16 50 / .12)' } :
                 { label: 'Poor Day',       color: 'var(--priority-high)', bg: 'oklch(68% .22 22 / .12)' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: rating.bg, border: `3px solid ${rating.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '20px', fontWeight: '900', color: rating.color, fontFamily: 'Inter, sans-serif' }}>{score.toFixed(1)}</p>
      </div>
      <div>
        <p style={{ fontSize: '16px', fontWeight: '800', color: rating.color, fontFamily: 'Inter, sans-serif' }}>{rating.label}</p>
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', fontFamily: 'Inter, sans-serif' }}>AI Score out of 10</p>
      </div>
    </div>
  )
}

function MiniHeatmap({ feedbackList }) {
  const days = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days.push(localDateString(d))
  }
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {days.map(ds => {
        const rec = feedbackList.find(f => f.date === ds)
        const studyHrs = parseFloat(rec?.study?.actualHours) || 0
        const hasExercise = parseFloat(rec?.exercise?.actualDuration) > 0
        const color = studyHrs > 0 && hasExercise ? 'oklch(65% .16 155)'
          : studyHrs > 0 ? 'oklch(65% .18 240)'
          : hasExercise ? 'var(--day-pressure)'
          : 'var(--surface-2)'
        return <div key={ds} style={{ width: '16px', height: '16px', borderRadius: '4px', background: color }} />
      })}
    </div>
  )
}

function computeLocalAnalysis(feedback, dayType) {
  if (!feedback) return null
  const { study, office, exercise } = feedback
  const totalActualStudy = parseFloat(study?.actualHours) || 0
  let score = 5, reclassifiedType = dayType, reclassifyReason = null

  if (totalActualStudy >= 4)      score += 2
  else if (totalActualStudy >= 3) score += 1.5
  else if (totalActualStudy >= 2) score += 0.5
  else if (totalActualStudy >= 1) score -= 0.5
  else                            score -= 1.5

  if (exercise) {
    const planned = parseFloat(exercise.plannedDuration) || 0
    const actual  = parseFloat(exercise.actualDuration)  || 0
    const pct = planned > 0 ? (actual / planned) * 100 : 0
    if (pct >= 100) score += 1
    else if (pct >= 75) score += 0.5
    else if (planned > 0 && pct < 50) score -= 0.5
  }

  if (office) {
    const meetings = parseInt(office.meetingsCount) || 0
    const blockers = (office.blockers || '').toLowerCase()
    const urgentWords = ['urgent', 'production', 'escalation', 'critical', 'emergency']
    const hasUrgent = urgentWords.some(w => blockers.includes(w))
    if (meetings >= 5 || hasUrgent) {
      reclassifiedType = 'High Pressure Day'
      reclassifyReason = `${meetings >= 5 ? meetings + ' meetings' : ''} ${hasUrgent ? '+ urgent blockers' : ''}`.trim()
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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } }) }
    )
    clearTimeout(timeout)
    const data = await res.json()
    if (data.error) { console.log('Gemini error:', data.error.message); return null }
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (e) { console.log('Gemini call failed:', e.message); return null }
}

function parseGeminiJSON(text) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()) } catch { return null }
}

export default function InsightsScreen() {
  const today = localDateString()
  const [todayFeedback, setTodayFeedback] = useState(null)
  const [dayType, setDayType]             = useState('Normal Day')
  const [allFeedback, setAllFeedback]     = useState([])
  const [analysis, setAnalysis]           = useState(null)
  const [monthSummary, setMonthSummary]   = useState(null)
  const [loading, setLoading]             = useState(false)
  const [aiMode, setAiMode]               = useState(false)
  const [subjectData, setSubjectData]     = useState([])
  const [totalPoints, setTotalPoints]     = useState(0)
  const [redeemedCount, setRedeemedCount] = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const dayRec = await db.days.get(today)
    const dt = dayRec?.dayType || 'Normal Day'
    setDayType(dt)

    let feedback = null, allFb = []
    try { feedback = await db.feedback?.get?.(today); allFb = await db.feedback?.toArray?.() || [] } catch {}
    setTodayFeedback(feedback)
    setAllFeedback(allFb)

    const subjMap = {}
    allFb.forEach(f => {
      if (f.study?.subjects?.length && f.study?.actualHours) {
        const hrs = parseFloat(f.study.actualHours) || 0
        const perSubject = hrs / f.study.subjects.length
        f.study.subjects.forEach(subName => { subjMap[subName] = (subjMap[subName] || 0) + perSubject })
      }
    })
    setSubjectData(Object.entries(subjMap).sort((a, b) => b[1] - a[1]))

    const allTasks = await db.tasks.toArray()
    const pts = allTasks.filter(t => t.completed && t.date !== 'template').reduce((sum, t) => sum + (t.points || 0), 0)
    let redPts = 0, redCount = 0
    try { const reds = await db.redemptions?.toArray?.() || []; redPts = reds.reduce((s, r) => s + r.cost, 0); redCount = reds.length } catch {}
    setTotalPoints(Math.max(0, pts - redPts))
    setRedeemedCount(redCount)

    buildMonthSummary(allFb)
    if (feedback) runAnalysis(feedback, dt, allFb)
  }

  async function runAnalysis(feedback, dt, allFb) {
    setLoading(true)
    const local = computeLocalAnalysis(feedback, dt)
    if (GEMINI_API_KEY) {
      try {
        const raw = await callGemini(buildPrompt(feedback, dt, allFb))
        if (raw) {
          const parsed = parseGeminiJSON(raw)
          if (parsed && parsed.score) { setAnalysis({ ...parsed, _source: 'ai' }); setAiMode(true); setLoading(false); buildMonthSummary(allFb); return }
        }
      } catch (e) { console.log('AI analysis failed, using local:', e.message) }
    }
    setAnalysis({ ...local, _source: 'local' }); setAiMode(false); buildMonthSummary(allFb); setLoading(false)
  }

  function buildPrompt(feedback, dt, allFb) {
    const recentDays = allFb.slice(-7)
    const totalStudy = feedback?.studySlots?.reduce((s, sess) => s + (parseFloat(sess.actualHours) || 0), 0) || 0
    const subjects = feedback?.studySlots?.map(s => `${s.subjectName}(${s.actualHours}h)`).filter(s => s).join(', ') || 'None'
    const topics = feedback?.studySlots?.map(s => s.topicNames?.join(', ') || s.topicName || '').filter(Boolean).join(', ') || 'None'
    const avgStudy = (recentDays.reduce((s, f) => s + (f.studySlots?.reduce((ss, sl) => ss + (parseFloat(sl.actualHours) || 0), 0) || f.study?.actualHours || 0), 0) / Math.max(recentDays.length, 1)).toFixed(1)
    return `You are a strict personal productivity coach for Asmita, a software developer at Accenture preparing for CIL Management Trainee (CS) government exam.\n\nToday's detailed data:\n- Day type (selected): ${dt}\n- Study sessions: ${feedback?.studySlots?.length || 0} sessions, total ${totalStudy}h\n- Subjects studied: ${subjects}\n- Topics covered: ${topics}\n- Office: ${feedback?.office?.actualHours || 0}h worked, ${feedback?.office?.meetingsCount || 0} meetings, work: ${feedback?.office?.workTypes?.join(', ') || 'N/A'}, blockers: "${feedback?.office?.blockers || 'None'}"\n- Exercise: Planned ${feedback?.exercise?.plannedDuration || 0}h, Actual ${feedback?.exercise?.actualDuration || 0}h, type: ${feedback?.exercise?.exerciseType || 'N/A'}\n- Overall satisfaction: ${feedback?.reflection?.overallSatisfaction || 0}/10\n- Last 7 days avg study: ${avgStudy}h/day\n\nRespond ONLY valid JSON:\n{\n  "score": 7.5,\n  "scoreBreakdown": ["+1.5 for 3h study"],\n  "reclassifiedType": "Normal Day",\n  "reclassifyReason": null,\n  "analysis": "...",\n  "recommendation": "...",\n  "realityCheck": null\n}`
  }

  function buildMonthSummary(allFb) {
    const now = new Date()
    const monthFb = allFb.filter(f => { const parts = f.date.split('-').map(Number); return parts[1] - 1 === now.getMonth() && parts[0] === now.getFullYear() })
    let actualStudy = 0, plannedEx = 0, actualEx = 0
    monthFb.forEach(f => { actualStudy += parseFloat(f?.study?.actualHours || 0); plannedEx += parseFloat(f?.exercise?.plannedDuration || 0); actualEx += parseFloat(f?.exercise?.actualDuration || 0) })
    const adherence = monthFb.length > 0 ? Math.min(100, Math.round((actualStudy / Math.max(actualStudy, 1)) * 100)) : 0
    setMonthSummary({ adherence, actualStudy: actualStudy.toFixed(1), plannedEx: plannedEx.toFixed(1), actualEx: actualEx.toFixed(1), daysLogged: monthFb.length })
  }

  const selectedColors = DAY_TYPE_CSS[dayType]
  const reclassifiedColors = analysis?.reclassifiedType ? DAY_TYPE_CSS[analysis.reclassifiedType] : null
  const showReclassification = analysis?.reclassifiedType && analysis.reclassifiedType !== dayType

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-fg)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>AI Analysis</p>
          <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--fg)' }}>Insights</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {aiMode && (
            <div style={{ background: 'oklch(65% .15 280 / .15)', border: '1px solid oklch(65% .15 280 / .3)', borderRadius: '20px', padding: '4px 10px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'oklch(75% .12 280)' }}>✦ Gemini AI</p>
            </div>
          )}
          <button onClick={loadAll} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={16} color='var(--muted-fg)' />
          </button>
        </div>
      </div>

      {!todayFeedback ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--fg)' }}>No feedback yet</p>
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '4px' }}>Submit today's feedback to see AI analysis</p>
        </div>
      ) : loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>🤖</p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--muted-fg)' }}>Analysing your day...</p>
        </div>
      ) : analysis ? (
        <>
          {showReclassification && (
            <InsightCard icon={Brain} iconColor='oklch(65% .15 280)' title="AI Day Reclassification">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: selectedColors.bg, border: `1px solid ${selectedColors.border}`, borderRadius: '8px', padding: '6px 12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: selectedColors.text }}>You: {dayType}</p>
                </div>
                <p style={{ fontSize: '16px', color: 'var(--muted-fg)' }}>→</p>
                <div style={{ background: reclassifiedColors.bg, border: `2px solid ${reclassifiedColors.border}`, borderRadius: '8px', padding: '6px 12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: reclassifiedColors.text }}>AI: {analysis.reclassifiedType}</p>
                </div>
              </div>
              {analysis.reclassifyReason && <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '10px', lineHeight: '1.5' }}>Reason: {analysis.reclassifyReason}</p>}
            </InsightCard>
          )}

          <InsightCard icon={Star} iconColor='var(--primary)' title="Today's Score">
            <ScoreBadge score={analysis.score || 5} />
            {analysis.scoreBreakdown?.length > 0 && (
              <div style={{ marginTop: '12px', background: 'var(--surface-2)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px' }}>Score Breakdown:</p>
                {analysis.scoreBreakdown.map((item, i) => (
                  <p key={i} style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'Inter, sans-serif', color: item.startsWith('+') ? 'oklch(65% .16 155)' : item.startsWith('-') ? 'var(--priority-high)' : 'var(--muted-fg)', marginBottom: '3px' }}>{item}</p>
                ))}
              </div>
            )}
          </InsightCard>

          <InsightCard icon={TrendingUp} iconColor='oklch(65% .18 240)' title="Daily Analysis">
            <p style={{ fontSize: '14px', color: 'var(--fg)', lineHeight: '1.6', fontWeight: '500' }}>{analysis.analysis}</p>
          </InsightCard>

          {analysis.realityCheck && (
            <InsightCard icon={Brain} iconColor='var(--priority-high)' title="Reality Check" bg='oklch(68% .22 22 / .08)' border='oklch(68% .22 22 / .3)'>
              <p style={{ fontSize: '14px', color: 'var(--priority-high)', lineHeight: '1.6', fontWeight: '500' }}>{analysis.realityCheck}</p>
            </InsightCard>
          )}

          <InsightCard icon={Brain} iconColor='oklch(65% .16 155)' title="AI Recommendation" bg='oklch(65% .16 155 / .08)' border='oklch(65% .16 155 / .25)'>
            <p style={{ fontSize: '14px', color: 'oklch(75% .14 155)', lineHeight: '1.6', fontWeight: '500' }}>{analysis.recommendation}</p>
          </InsightCard>

          {subjectData.length > 0 && (
            <InsightCard icon={BookOpen} iconColor='oklch(65% .18 240)' title="Subject Analysis">
              {subjectData.map(([subject, hrs]) => (
                <div key={subject} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--fg)' }}>{subject}</p>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'oklch(65% .18 240)' }}>{hrs.toFixed(1)} hrs</p>
                </div>
              ))}
            </InsightCard>
          )}

          <InsightCard icon={Dumbbell} iconColor='oklch(65% .16 155)' title="Streak Analysis">
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)', marginBottom: '8px' }}>Last 28 days</p>
            <MiniHeatmap feedbackList={allFeedback} />
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
              {[
                { color: 'oklch(65% .16 155)', label: 'Study + Exercise' },
                { color: 'oklch(65% .18 240)', label: 'Study only' },
                { color: 'var(--day-pressure)', label: 'Exercise only' },
                { color: 'var(--surface-2)', label: 'Missed' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                  <p style={{ fontSize: '10px', color: 'var(--muted-fg)', fontWeight: '500' }}>{l.label}</p>
                </div>
              ))}
            </div>
          </InsightCard>

          {monthSummary && (
            <InsightCard icon={BarChart2} iconColor='oklch(65% .15 280)' title="Monthly Summary">
              <div style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Days Logged',     value: monthSummary.daysLogged },
                  { label: 'Adherence',       value: `${monthSummary.adherence}%` },
                  { label: 'Study Hours',     value: `${monthSummary.actualStudy}h` },
                  { label: 'Exercise Planned',value: `${monthSummary.plannedEx}h` },
                  { label: 'Exercise Done',   value: `${monthSummary.actualEx}h` },
                  { label: 'Total Points',    value: totalPoints.toLocaleString() },
                  { label: 'Rewards Redeemed',value: redeemedCount },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted-fg)' }}>{item.label}</p>
                    <p style={{ fontSize: '17px', fontWeight: '900', color: 'var(--fg)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          <InsightCard icon={Brain} iconColor='oklch(65% .15 280)' title="Monthly Review">
            <p style={{ fontSize: '14px', color: 'var(--fg)', lineHeight: '1.6', fontWeight: '500' }}>
              {monthSummary?.adherence >= 80 ? 'Strong overall adherence this month. Keep the momentum going.' : 'Study execution dropped on high-pressure workdays. Plan buffer time for office-heavy days.'}
            </p>
          </InsightCard>
        </>
      ) : null}
    </div>
  )
}