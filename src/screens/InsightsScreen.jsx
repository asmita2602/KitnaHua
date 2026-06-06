import { useState, useEffect } from 'react'
import { Brain, RefreshCw, TrendingUp, BookOpen, Dumbbell, Star, BarChart2 } from 'lucide-react'
import { db } from '../db'

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const DAY_TYPE_COLORS = {
  'Normal Day': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'High Pressure Day': { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  'Travel Day': { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  'Weekend Day': { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
}

function InsightCard({ icon: Icon, iconColor, title, children, bg = '#fff', border = '#e2e8f0' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: '16px', padding: '16px', marginBottom: '12px',
    }}>
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
    score >= 7 ? { label: 'Good Day', color: '#3b82f6', bg: '#dbeafe' } :
    score >= 5 ? { label: 'Average Day', color: '#f97316', bg: '#ffedd5' } :
    { label: 'Poor Day', color: '#ef4444', bg: '#fee2e2' }

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
  const today = new Date()
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    days.push(ds)
  }

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {days.map(ds => {
        const rec = feedbackList.find(f => f.date === ds)
        const hasStudy = rec?.study?.actualHours > 0
        const hasExercise = rec?.exercise?.actualDuration > 0
        const color = hasStudy && hasExercise ? '#22c55e' : hasStudy ? '#3b82f6' : hasExercise ? '#f97316' : '#e2e8f0'
        return (
          <div key={ds} style={{
            width: '16px', height: '16px', borderRadius: '4px',
            background: color, flexShrink: 0,
            title: ds,
          }} />
        )
      })}
    </div>
  )
}

// Rule-based fallback engine
function computeLocalAnalysis(feedback, dayType) {
  if (!feedback) return null
  const { study, office, exercise } = feedback

  let score = 5
  let reasons = []
  let reclassifiedType = dayType
  let reclassifyReason = null

  // Study scoring
  if (study) {
    const planned = parseFloat(study.plannedHours) || 0
    const actual = parseFloat(study.actualHours) || 0
    const pct = planned > 0 ? (actual / planned) * 100 : 0
    if (pct >= 100) { score += 2; reasons.push('Study target met ✓') }
    else if (pct >= 80) { score += 1.5; reasons.push('Study nearly complete') }
    else if (pct >= 60) { score += 0.5; reasons.push('Study partially done') }
    else if (pct >= 40) { score -= 0.5; reasons.push('Study below average') }
    else if (planned > 0) { score -= 1.5; reasons.push('Study severely behind') }
  }

  // Exercise scoring
  if (exercise) {
    const planned = parseFloat(exercise.plannedDuration) || 0
    const actual = parseFloat(exercise.actualDuration) || 0
    const pct = planned > 0 ? (actual / planned) * 100 : 0
    if (pct >= 100) { score += 1; reasons.push('Exercise completed ✓') }
    else if (pct >= 75) { score += 0.5; reasons.push('Exercise mostly done') }
    else if (planned > 0 && pct < 50) { score -= 0.5; reasons.push('Exercise incomplete') }
  }

  // Day reclassification
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

  const studyPct = study
    ? Math.round((parseFloat(study.actualHours) / Math.max(parseFloat(study.plannedHours), 0.1)) * 100)
    : null

  let analysis = ''
  if (studyPct !== null) {
    if (studyPct >= 100) analysis = 'Study target achieved. Maintain this consistency going forward.'
    else if (studyPct >= 80) analysis = `Study was ${studyPct}% of target — close but not quite there.`
    else analysis = `Study was only ${studyPct}% of target. Office workload was the likely factor.`
  } else {
    analysis = 'No study data available for today.'
  }

  let recommendation = 'Plan tomorrow\'s study blocks before office hours begin.'
  if (exercise && parseFloat(exercise.actualDuration) === 0) {
    recommendation = 'Prioritise even a short 20-min exercise session tomorrow morning.'
  }

  return { score, reclassifiedType, reclassifyReason, analysis, recommendation, reasons }
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
  const today = getTodayString()
  const [todayFeedback, setTodayFeedback] = useState(null)
  const [dayType, setDayType] = useState('Normal Day')
  const [allFeedback, setAllFeedback] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [monthSummary, setMonthSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [subjectData, setSubjectData] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [redeemedCount, setRedeemedCount] = useState(0)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const dayRec = await db.days.get(today)
    const dt = dayRec?.dayType || 'Normal Day'
    setDayType(dt)

    let feedback = null
    let allFb = []
    try {
      feedback = await db.feedback?.get?.(today)
      allFb = await db.feedback?.toArray?.() || []
    } catch {}
    setTodayFeedback(feedback)
    setAllFeedback(allFb)

    // Subject hours aggregation from all feedback
    const subjMap = {}
    allFb.forEach(f => {
      if (f.study?.subjects?.length && f.study?.actualHours) {
        const hrs = parseFloat(f.study.actualHours) || 0
        const perSubject = hrs / f.study.subjects.length
        f.study.subjects.forEach(s => {
          subjMap[s] = (subjMap[s] || 0) + perSubject
        })
      }
    })
    setSubjectData(Object.entries(subjMap).sort((a, b) => b[1] - a[1]))

    // Points
    const allTasks = await db.tasks.toArray()
    const pts = allTasks.filter(t => t.completed && t.date !== 'template')
      .reduce((sum, t) => sum + (t.points || 0), 0)
    let redPts = 0
    let redCount = 0
    try {
      const reds = await db.redemptions?.toArray?.() || []
      redPts = reds.reduce((s, r) => s + r.cost, 0)
      redCount = reds.length
    } catch {}
    setTotalPoints(Math.max(0, pts - redPts))
    setRedeemedCount(redCount)

    // Run analysis
    if (feedback) runAnalysis(feedback, dt, allFb)
  }

  async function runAnalysis(feedback, dt, allFb) {
    setLoading(true)
    const local = computeLocalAnalysis(feedback, dt)

    // Try Gemini if key exists
    if (GEMINI_API_KEY) {
      const prompt = buildPrompt(feedback, dt, allFb)
      const raw = await callGemini(prompt)
      if (raw) {
        const parsed = parseGeminiJSON(raw)
        if (parsed) {
          setAnalysis({ ...parsed, _source: 'ai' })
          setAiMode(true)
          setLoading(false)
          buildMonthSummary(allFb, allFb)
          return
        }
      }
    }

    setAnalysis({ ...local, _source: 'local' })
    setAiMode(false)
    buildMonthSummary(allFb, allFb)
    setLoading(false)
  }

  function buildPrompt(feedback, dt, allFb) {
    const recentDays = allFb.slice(-7)
    return `You are a strict productivity coach for Asmita, a working professional preparing for government exams.

Today's data:
- Selected day type: ${dt}
- Study: Planned ${feedback?.study?.plannedHours || 0}h, Actual ${feedback?.study?.actualHours || 0}h, Subjects: ${feedback?.study?.subjects?.join(', ') || 'None'}, Blockers: "${feedback?.study?.blockers || 'None'}", Satisfaction: ${feedback?.study?.satisfaction || 0}/10
- Office: Hours ${feedback?.office?.actualHours || 0}, Meetings: ${feedback?.office?.meetingsCount || 0}, Work: ${feedback?.office?.workTypes?.join(', ') || 'N/A'}, Blockers: "${feedback?.office?.blockers || 'None'}", Satisfaction: ${feedback?.office?.satisfaction || 0}/10
- Exercise: Planned ${feedback?.exercise?.plannedDuration || 0}h, Actual ${feedback?.exercise?.actualDuration || 0}h, Type: ${feedback?.exercise?.exerciseType || 'N/A'}, Feel: ${feedback?.exercise?.feel || 'N/A'}, Satisfaction: ${feedback?.exercise?.satisfaction || 0}/10
- Reflection: Overall ${feedback?.reflection?.overallSatisfaction || 0}/10, Achievement: "${feedback?.reflection?.biggestAchievement || ''}", Challenge: "${feedback?.reflection?.biggestChallenge || ''}"

Recent 7 days average study hours: ${(recentDays.reduce((s, f) => s + parseFloat(f?.study?.actualHours || 0), 0) / Math.max(recentDays.length, 1)).toFixed(1)}h

Scoring rules:
- Study: 100%+ = Excellent (+2), 80-99% = Good (+1.5), 60-79% = Average (+0.5), 40-59% = Below avg (-0.5), <40% = Poor (-1.5)
- Exercise: 100%+ = +1, 75-99% = +0.5, <50% = -0.5
- Base score: 5
- Final range: 1-10

Day reclassification: If meetings >= 5 or blockers contain urgent/production/critical words and user selected Normal Day, reclassify to High Pressure Day.

Be strict but not rude. Do NOT praise excessively. Give a reality check if study was missed.

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "score": 7.5,
  "reclassifiedType": "High Pressure Day",
  "reclassifyReason": "6 meetings and urgent production issue",
  "analysis": "Two-line max analysis of today's performance",
  "recommendation": "One actionable recommendation for tomorrow",
  "realityCheck": "Honest assessment if targets were missed (or null if met)"
}`
  }

  function buildMonthSummary(allFb, _) {
    const now = new Date()
    const monthFb = allFb.filter(f => {
      const d = new Date(f.date + 'T00:00:00')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    let plannedStudy = 0, actualStudy = 0
    let plannedEx = 0, actualEx = 0
    monthFb.forEach(f => {
      plannedStudy += parseFloat(f?.study?.plannedHours || 0)
      actualStudy += parseFloat(f?.study?.actualHours || 0)
      plannedEx += parseFloat(f?.exercise?.plannedDuration || 0)
      actualEx += parseFloat(f?.exercise?.actualDuration || 0)
    })

    const adherence = monthFb.length > 0
      ? Math.round(((actualStudy / Math.max(plannedStudy, 1)) * 0.6 + (actualEx / Math.max(plannedEx, 1)) * 0.4) * 100)
      : 0

    setMonthSummary({
      adherence: Math.min(adherence, 100),
      plannedStudy: plannedStudy.toFixed(1),
      actualStudy: actualStudy.toFixed(1),
      plannedEx: plannedEx.toFixed(1),
      actualEx: actualEx.toFixed(1),
      daysLogged: monthFb.length,
    })
  }

  const selectedColors = DAY_TYPE_COLORS[dayType]
  const reclassifiedColors = analysis?.reclassifiedType
    ? DAY_TYPE_COLORS[analysis.reclassifiedType]
    : null
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
            <div style={{
              background: '#ede9fe', border: '1px solid #a78bfa',
              borderRadius: '20px', padding: '4px 10px',
            }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#5b21b6', fontFamily: 'Nunito, sans-serif' }}>
                ✦ Gemini AI
              </p>
            </div>
          )}
          <button
            onClick={loadAll}
            style={{
              background: '#f1f5f9', border: 'none', borderRadius: '10px',
              width: '36px', height: '36px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={16} color='#64748b' />
          </button>
        </div>
      </div>

      {!todayFeedback ? (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '28px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
            No feedback yet
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px', fontFamily: 'Nunito, sans-serif' }}>
            Submit today's feedback to see AI analysis
          </p>
        </div>
      ) : loading ? (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '28px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>🤖</p>
          <p style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', fontFamily: 'Nunito, sans-serif' }}>
            Analysing your day...
          </p>
        </div>
      ) : analysis ? (
        <>
          {/* Card 1: Day Reclassification */}
          {showReclassification && (
            <InsightCard icon={Brain} iconColor='#8b5cf6' title="AI Day Reclassification">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                  background: selectedColors.bg, border: `1px solid ${selectedColors.border}`,
                  borderRadius: '8px', padding: '6px 12px',
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '800', color: selectedColors.text, fontFamily: 'Nunito, sans-serif' }}>
                    You: {dayType}
                  </p>
                </div>
                <p style={{ fontSize: '16px', color: '#94a3b8' }}>→</p>
                <div style={{
                  background: reclassifiedColors.bg, border: `2px solid ${reclassifiedColors.border}`,
                  borderRadius: '8px', padding: '6px 12px',
                }}>
                  <p style={{ fontSize: '12px', fontWeight: '800', color: reclassifiedColors.text, fontFamily: 'Nunito, sans-serif' }}>
                    AI: {analysis.reclassifiedType}
                  </p>
                </div>
              </div>
              {analysis.reclassifyReason && (
                <p style={{
                  fontSize: '13px', color: '#64748b', marginTop: '10px',
                  fontFamily: 'Nunito, sans-serif', lineHeight: '1.5',
                }}>
                  Reason: {analysis.reclassifyReason}
                </p>
              )}
            </InsightCard>
          )}

          {/* Card 2: Score */}
          <InsightCard icon={Star} iconColor='#f59e0b' title="Today's Score">
            <ScoreBadge score={analysis.score || 5} />
          </InsightCard>

          {/* Card 3: AI Daily Analysis */}
          <InsightCard icon={TrendingUp} iconColor='#3b82f6' title="Daily Analysis">
            <p style={{
              fontSize: '14px', color: '#334155', lineHeight: '1.6',
              fontFamily: 'Nunito, sans-serif', fontWeight: '600',
            }}>
              {analysis.analysis}
            </p>
          </InsightCard>

          {/* Card 4: Reality Check */}
          {analysis.realityCheck && (
            <InsightCard icon={Brain} iconColor='#ef4444' title="Reality Check"
              bg='#fff5f5' border='#fecaca'>
              <p style={{
                fontSize: '14px', color: '#dc2626', lineHeight: '1.6',
                fontFamily: 'Nunito, sans-serif', fontWeight: '600',
              }}>
                {analysis.realityCheck}
              </p>
            </InsightCard>
          )}

          {/* Card 4b: Recommendation */}
          <InsightCard icon={Brain} iconColor='#22c55e' title="AI Recommendation"
            bg='#f0fdf4' border='#bbf7d0'>
            <p style={{
              fontSize: '14px', color: '#15803d', lineHeight: '1.6',
              fontFamily: 'Nunito, sans-serif', fontWeight: '600',
            }}>
              {analysis.recommendation}
            </p>
          </InsightCard>

          {/* Card 5: Subject Analysis */}
          {subjectData.length > 0 && (
            <InsightCard icon={BookOpen} iconColor='#3b82f6' title="Subject Analysis">
              {subjectData.map(([subject, hrs]) => (
                <div key={subject} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f1f5f9',
                }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
                    {subject}
                  </p>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6', fontFamily: 'Nunito, sans-serif' }}>
                    {hrs.toFixed(1)} hrs
                  </p>
                </div>
              ))}
            </InsightCard>
          )}

          {/* Card 6: Streak Analysis */}
          <InsightCard icon={Dumbbell} iconColor='#22c55e' title="Streak Analysis">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {[
                {
                  label: 'Study', value: allFeedback.filter((_, i, a) => {
                    const sorted = [...a].sort((x, y) => x.date < y.date ? 1 : -1)
                    const idx = sorted.findIndex(f => f.date === allFeedback[i]?.date)
                    return idx !== undefined
                  }).length, color: '#3b82f6', bg: '#dbeafe',
                },
              ].slice(0, 0).map(() => null) /* just use the heatmap below */}
            </div>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', fontFamily: 'Nunito, sans-serif' }}>
              Last 28 days
            </p>
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
                  <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', fontFamily: 'Nunito, sans-serif' }}>
                    {l.label}
                  </p>
                </div>
              ))}
            </div>
          </InsightCard>

          {/* Card 7: Monthly Summary */}
          {monthSummary && (
            <InsightCard icon={BarChart2} iconColor='#8b5cf6' title="Monthly Summary">
              <div style={{
                background: '#f8fafc', borderRadius: '12px', padding: '14px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
              }}>
                {[
                  { label: 'Adherence', value: `${monthSummary.adherence}%` },
                  { label: 'Days Logged', value: monthSummary.daysLogged },
                  { label: 'Study: Planned', value: `${monthSummary.plannedStudy}h` },
                  { label: 'Study: Actual', value: `${monthSummary.actualStudy}h` },
                  { label: 'Exercise: Planned', value: `${monthSummary.plannedEx}h` },
                  { label: 'Exercise: Actual', value: `${monthSummary.actualEx}h` },
                  { label: 'Total Points', value: totalPoints.toLocaleString() },
                  { label: 'Rewards Redeemed', value: redeemedCount },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </InsightCard>
          )}

          {/* Card 8: AI Monthly Review */}
          {!aiMode && (
            <InsightCard icon={Brain} iconColor='#8b5cf6' title="Monthly Review">
              <p style={{
                fontSize: '14px', color: '#334155', lineHeight: '1.6',
                fontFamily: 'Nunito, sans-serif', fontWeight: '600',
              }}>
                {monthSummary?.adherence >= 80
                  ? 'Strong overall adherence this month. Keep the momentum going into next month.'
                  : 'Study execution dropped on high-pressure workdays. Plan buffer time for office-heavy days.'}
              </p>
            </InsightCard>
          )}
        </>
      ) : null}
    </div>
  )
}
