import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const WORK_TYPES = ['Meetings', 'Access Requests', 'Development', 'Scripting', 'Documentation']
const FEEL_OPTIONS = ['Energetic', 'Normal', 'Tired']

const SECTION_COLORS = {
  Study:      { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
  Office:     { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', dot: '#6366f1' },
  Exercise:   { bg: '#dcfce7', border: '#86efac', text: '#14532d', dot: '#22c55e' },
  Reflection: { bg: '#fef9c3', border: '#fde047', text: '#854d0e', dot: '#eab308' },
}

function SatisfactionRow({ value, onChange, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: `2px solid ${value >= n ? color : '#e2e8f0'}`,
            background: value >= n ? color : '#f8fafc',
            color: value >= n ? '#fff' : '#94a3b8',
            fontSize: '11px', fontWeight: '800', cursor: 'pointer',
            fontFamily: 'Nunito, sans-serif',
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>Poor</span>
        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>Excellent</span>
      </div>
    </div>
  )
}

function Section({ title, icon, colorKey, isOpen, onToggle, isDone, children }) {
  const c = SECTION_COLORS[colorKey]
  return (
    <div style={{
      background: '#fff',
      border: isDone ? `2px solid ${c.border}` : '1px solid #e2e8f0',
      borderRadius: '16px', marginBottom: '12px', overflow: 'hidden',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '16px',
        background: isDone ? c.bg : '#fff', border: 'none',
        cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isDone ? c.dot : '#cbd5e1' }} />
          <span style={{ fontSize: '15px', fontWeight: '800', color: isDone ? c.text : '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
            {icon} {title}
          </span>
          {isDone && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '2px 8px' }}>
              Done ✓
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} color='#94a3b8' /> : <ChevronDown size={18} color='#94a3b8' />}
      </button>
      {isOpen && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function Label({ children }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: '800', color: '#64748b',
      marginBottom: '6px', marginTop: '14px',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      fontFamily: 'Nunito, sans-serif',
    }}>{children}</p>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: '10px',
        border: '1px solid #e2e8f0', fontSize: '14px',
        fontFamily: 'Nunito, sans-serif', outline: 'none',
        color: '#0f172a', boxSizing: 'border-box', background: '#f8fafc',
      }}
    />
  )
}

function Chips({ options, value, onChange, multi = false }) {
  const toggle = (opt) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt])
    } else {
      onChange(value === opt ? '' : opt)
    }
  }
  const selected = (opt) => multi ? (Array.isArray(value) && value.includes(opt)) : value === opt
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => toggle(opt)} style={{
          padding: '7px 14px', borderRadius: '20px', border: 'none',
          cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
          fontSize: '12px', fontWeight: '700',
          background: selected(opt) ? '#0f172a' : '#f1f5f9',
          color: selected(opt) ? '#fff' : '#64748b',
        }}>{opt}</button>
      ))}
    </div>
  )
}

export default function FeedbackScreen({ onSave }) {
  const today = localDateString()
  const [open, setOpen] = useState('Study')
  const [subjectOptions, setSubjectOptions] = useState([])
  const [study, setStudy] = useState({ plannedHours: '', actualHours: '', subjects: [], blockers: '', satisfaction: 0 })
  const [office, setOffice] = useState({ actualHours: '', workTypes: [], meetingsCount: '', blockers: '', satisfaction: 0 })
  const [exercise, setExercise] = useState({ plannedDuration: '', actualDuration: '', exerciseType: '', feel: '', satisfaction: 0 })
  const [reflection, setReflection] = useState({ overallSatisfaction: 0, biggestAchievement: '', biggestChallenge: '' })
  const [studyDone, setStudyDone] = useState(false)
  const [officeDone, setOfficeDone] = useState(false)
  const [exerciseDone, setExerciseDone] = useState(false)
  const [reflectionDone, setReflectionDone] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const subs = await db.subjects.toArray()
      setSubjectOptions(subs.map(s => s.name))
    } catch {
      setSubjectOptions(['Quant', 'Reasoning', 'DSA', 'DBMS', 'OIC', 'AWS'])
    }

    try {
      const rec = await db.feedback?.get?.(today)
      if (rec) {
        if (rec.study)      { setStudy(rec.study);           setStudyDone(true) }
        if (rec.office)     { setOffice(rec.office);         setOfficeDone(true) }
        if (rec.exercise)   { setExercise(rec.exercise);     setExerciseDone(true) }
        if (rec.reflection) { setReflection(rec.reflection); setReflectionDone(true) }
      }
    } catch {}

    try {
      const dayRec = await db.days.get(today)
      const dayType = dayRec?.dayType || 'Normal Day'
      const blocks = await db.tasks.where('date').equals('template').toArray()
      const forToday = blocks.filter(b => b.dayTypeTemplate === dayType)

      const studyMins = forToday
        .filter(b => b.tag === 'Study' && b.startTime && b.endTime)
        .reduce((s, b) => {
          const [sh, sm] = b.startTime.split(':').map(Number)
          const [eh, em] = b.endTime.split(':').map(Number)
          return s + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
        }, 0)

      const exMins = forToday
        .filter(b => b.tag === 'Exercise' && b.startTime && b.endTime)
        .reduce((s, b) => {
          const [sh, sm] = b.startTime.split(':').map(Number)
          const [eh, em] = b.endTime.split(':').map(Number)
          return s + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
        }, 0)

      if (studyMins > 0) setStudy(p => ({ ...p, plannedHours: (studyMins / 60).toFixed(1) }))
      if (exMins > 0)    setExercise(p => ({ ...p, plannedDuration: (exMins / 60).toFixed(1) }))
    } catch {}
  }

  async function syncSubjectsToLectures(studiedSubjectNames) {
    if (!studiedSubjectNames?.length) return
    try {
      const now = new Date().toISOString()
      const allSubjects = await db.subjects.toArray()
      for (const subName of studiedSubjectNames) {
        const subRecord = allSubjects.find(s => s.name === subName)
        if (!subRecord) continue
        const topics = await db.topics.where('subjectId').equals(subRecord.id).toArray()
        for (const topic of topics) {
          const lectures = await db.lectures.where('topicId').equals(topic.id).toArray()
          for (const lec of lectures) {
            const alreadyToday = lec.lastStudied && lec.lastStudied.startsWith(today)
            if (!alreadyToday) {
              await db.lectures.update(lec.id, { lastStudied: now })
            }
          }
        }
      }
    } catch (e) {
      console.log('syncSubjectsToLectures error:', e)
    }
  }

  async function calculateBonusPoints(feedbackRecord) {
    let bonus = 0

    // Study streak bonus — every 7 days = +20 pts
    try {
      const allFeedback = await db.feedback.toArray()
      let streak = 0
      for (let i = 0; ; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = localDateString(d)
        const rec = ds === today ? feedbackRecord : allFeedback.find(f => f.date === ds)
        if (!rec || !rec.study?.actualHours || parseFloat(rec.study.actualHours) <= 0) break
        streak++
      }
      bonus += Math.floor(streak / 7) * 20
    } catch {}

    // Extra study hour bonus — actual > planned + 1hr → +1/3 of task points
    try {
      const planned = parseFloat(feedbackRecord.study?.plannedHours) || 0
      const actual  = parseFloat(feedbackRecord.study?.actualHours)  || 0
      if (actual - planned > 1) {
        const todayTasks = await db.tasks.where('date').equals(today).toArray()
        const taskPoints = todayTasks
          .filter(t => t.completed)
          .reduce((sum, t) => sum + (t.points || 0), 0)
        bonus += Math.round(taskPoints / 3)
      }
    } catch {}

    return bonus
  }

  async function saveSection(section) {
    let existing = {}
    try { existing = (await db.feedback?.get?.(today)) || {} } catch {}
    const updated = { date: today, ...existing }

    if (section === 'Study') {
      updated.study = study
      setStudyDone(true)
      await syncSubjectsToLectures(study.subjects)
    }
    if (section === 'Office')   { updated.office = office;     setOfficeDone(true) }
    if (section === 'Exercise') { updated.exercise = exercise; setExerciseDone(true) }
    if (section === 'Reflection') {
      updated.reflection = reflection
      setReflectionDone(true)
      updated.bonusPoints = await calculateBonusPoints(updated)
    }

    try { await db.feedback?.put?.(updated) } catch {}
    setOpen(null)
    onSave?.('feedback', updated)
  }

  const allDone = studyDone && officeDone && exerciseDone && reflectionDone
  const toggle = (key) => setOpen(o => o === key ? null : key)

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Nunito, sans-serif' }}>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Daily Feedback</p>
        <p style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>{formatDate(today)}</p>
      </div>

      {allDone && (
        <div style={{
          background: '#f0fdf4', border: '2px solid #4ade80',
          borderRadius: '14px', padding: '14px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <CheckCircle size={22} color='#22c55e' />
          <div>
            <p style={{ fontSize: '14px', fontWeight: '800', color: '#14532d' }}>All feedback submitted!</p>
            <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '2px' }}>Head to Insights for your AI analysis.</p>
          </div>
        </div>
      )}

      <Section title="Study Feedback" icon="📚" colorKey="Study"
        isOpen={open === 'Study'} onToggle={() => toggle('Study')} isDone={studyDone}>
        <Label>Planned Hours</Label>
        <TextInput value={study.plannedHours} onChange={v => setStudy({ ...study, plannedHours: v })} placeholder="e.g. 4" type="number" />
        <Label>Actual Hours</Label>
        <TextInput value={study.actualHours} onChange={v => setStudy({ ...study, actualHours: v })} placeholder="e.g. 2.5" type="number" />
        <Label>Subjects Studied</Label>
        {subjectOptions.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
            No subjects yet — add them in the Subjects screen first.
          </p>
        ) : (
          <Chips options={subjectOptions} value={study.subjects}
            onChange={v => setStudy({ ...study, subjects: v })} multi />
        )}
        <Label>Major Blockers</Label>
        <TextInput value={study.blockers} onChange={v => setStudy({ ...study, blockers: v })} placeholder="e.g. Unexpected office calls" />
        <Label>Satisfaction (1–10)</Label>
        <SatisfactionRow value={study.satisfaction} onChange={v => setStudy({ ...study, satisfaction: v })} color='#3b82f6' />
        <button onClick={() => saveSection('Study')} style={saveBtn}>Save Study Feedback</button>
      </Section>

      <Section title="Office Feedback" icon="💼" colorKey="Office"
        isOpen={open === 'Office'} onToggle={() => toggle('Office')} isDone={officeDone}>
        <Label>Actual Office Hours</Label>
        <TextInput value={office.actualHours} onChange={v => setOffice({ ...office, actualHours: v })} placeholder="e.g. 8" type="number" />
        <Label>Work Type</Label>
        <Chips options={WORK_TYPES} value={office.workTypes} onChange={v => setOffice({ ...office, workTypes: v })} multi />
        <Label>Number of Meetings</Label>
        <TextInput value={office.meetingsCount} onChange={v => setOffice({ ...office, meetingsCount: v })} placeholder="e.g. 4" type="number" />
        <Label>Major Blockers</Label>
        <TextInput value={office.blockers} onChange={v => setOffice({ ...office, blockers: v })} placeholder="e.g. Production issue escalation" />
        <Label>Satisfaction (1–10)</Label>
        <SatisfactionRow value={office.satisfaction} onChange={v => setOffice({ ...office, satisfaction: v })} color='#6366f1' />
        <button onClick={() => saveSection('Office')} style={saveBtn}>Save Office Feedback</button>
      </Section>

      <Section title="Exercise Feedback" icon="🏃" colorKey="Exercise"
        isOpen={open === 'Exercise'} onToggle={() => toggle('Exercise')} isDone={exerciseDone}>
        <Label>Planned Duration (hrs)</Label>
        <TextInput value={exercise.plannedDuration} onChange={v => setExercise({ ...exercise, plannedDuration: v })} placeholder="e.g. 1" type="number" />
        <Label>Actual Duration (hrs)</Label>
        <TextInput value={exercise.actualDuration} onChange={v => setExercise({ ...exercise, actualDuration: v })} placeholder="e.g. 0.5" type="number" />
        <Label>Exercise Type</Label>
        <TextInput value={exercise.exerciseType} onChange={v => setExercise({ ...exercise, exerciseType: v })} placeholder="e.g. Running, Yoga, Gym" />
        <Label>How Did You Feel?</Label>
        <Chips options={FEEL_OPTIONS} value={exercise.feel} onChange={v => setExercise({ ...exercise, feel: v })} />
        <Label>Satisfaction (1–10)</Label>
        <SatisfactionRow value={exercise.satisfaction} onChange={v => setExercise({ ...exercise, satisfaction: v })} color='#22c55e' />
        <button onClick={() => saveSection('Exercise')} style={saveBtn}>Save Exercise Feedback</button>
      </Section>

      <Section title="End of Day Reflection" icon="🌙" colorKey="Reflection"
        isOpen={open === 'Reflection'} onToggle={() => toggle('Reflection')} isDone={reflectionDone}>
        <Label>Overall Satisfaction (1–10)</Label>
        <SatisfactionRow value={reflection.overallSatisfaction} onChange={v => setReflection({ ...reflection, overallSatisfaction: v })} color='#eab308' />
        <Label>Biggest Achievement</Label>
        <textarea value={reflection.biggestAchievement}
          onChange={e => setReflection({ ...reflection, biggestAchievement: e.target.value })}
          placeholder="What went well today?" rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', resize: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
        />
        <Label>Biggest Challenge</Label>
        <textarea value={reflection.biggestChallenge}
          onChange={e => setReflection({ ...reflection, biggestChallenge: e.target.value })}
          placeholder="What was hard today?" rows={2}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', resize: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
        />
        <button onClick={() => saveSection('Reflection')} style={saveBtn}>Save Reflection</button>
      </Section>

    </div>
  )
}

const saveBtn = {
  marginTop: '18px', width: '100%', padding: '12px',
  background: '#0f172a', color: '#fff', border: 'none',
  borderRadius: '12px', fontFamily: 'Nunito, sans-serif',
  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
}