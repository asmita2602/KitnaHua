import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMins(mins) {
  if (!mins || mins <= 0) return '0h'
  return mins < 60 ? `${mins}m` : `${Math.round((mins / 60) * 10) / 10}h`
}

const WORK_TYPES = ['Meetings', 'Access Requests', 'Development', 'Scripting', 'Documentation']
const FEEL_OPTIONS = ['Energetic', 'Normal', 'Tired']
const ACTIVITY_OPTIONS = ['Lecture Watched', 'Notes Made', 'Questions Solved', 'Revised', 'Learned']

const SECTION_COLORS = {
  Study:      { bg: 'oklch(65% .18 240 / .12)', border: 'oklch(65% .18 240 / .3)', text: 'oklch(75% .15 240)', dot: 'oklch(65% .18 240)' },
  Office:     { bg: 'oklch(65% .15 280 / .12)', border: 'oklch(65% .15 280 / .3)', text: 'oklch(75% .12 280)', dot: 'oklch(65% .15 280)' },
  Exercise:   { bg: 'oklch(65% .16 155 / .12)', border: 'oklch(65% .16 155 / .3)', text: 'oklch(75% .14 155)', dot: 'oklch(65% .16 155)' },
  Reflection: { bg: 'oklch(83% .17 75 / .12)',  border: 'oklch(83% .17 75 / .3)',  text: 'var(--primary)',    dot: 'var(--primary)' },
}

function SatisfactionRow({ value, onChange, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '26px', height: '26px', borderRadius: '50%',
            border: `2px solid ${value >= n ? color : 'var(--border)'}`,
            background: value >= n ? color : 'var(--surface-2)',
            color: value >= n ? 'oklch(16% .02 270)' : 'var(--muted-fg)',
            fontSize: '11px', fontWeight: '700', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: 'var(--muted-fg)', fontWeight: '500' }}>Poor</span>
        <span style={{ fontSize: '10px', color: 'var(--muted-fg)', fontWeight: '500' }}>Excellent</span>
      </div>
    </div>
  )
}

function Section({ title, icon, colorKey, isOpen, onToggle, isDone, children }) {
  const c = SECTION_COLORS[colorKey]
  return (
    <div style={{
      background: 'var(--surface)',
      border: isDone ? `1.5px solid ${c.border}` : '1px solid var(--border)',
      borderRadius: '16px', marginBottom: '12px', overflow: 'hidden',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '16px',
        background: isDone ? c.bg : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isDone ? c.dot : 'var(--border)' }} />
          <span style={{ fontSize: '15px', fontWeight: '700', color: isDone ? c.text : 'var(--fg)' }}>
            {icon} {title}
          </span>
          {isDone && (
            <span style={{ fontSize: '11px', fontWeight: '700', color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '2px 8px' }}>
              Done ✓
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} color='var(--muted-fg)' /> : <ChevronDown size={18} color='var(--muted-fg)' />}
      </button>
      {isOpen && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function Label({ children }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)',
      marginBottom: '6px', marginTop: '14px',
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>{children}</p>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: '10px',
        border: '1px solid var(--border)', fontSize: '14px',
        fontFamily: 'Inter, sans-serif', outline: 'none',
        color: 'var(--fg)', boxSizing: 'border-box',
        background: 'var(--surface-2)', colorScheme: 'dark',
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
          padding: '6px 12px', borderRadius: '20px', border: 'none',
          cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          fontSize: '12px', fontWeight: '600',
          background: selected(opt) ? 'var(--primary)' : 'var(--surface-2)',
          color: selected(opt) ? 'oklch(16% .02 270)' : 'var(--muted-fg)',
        }}>{opt}</button>
      ))}
    </div>
  )
}

function StudySlot({ slot, idx, subjects, onUpdate, onDelete }) {
  const [topics, setTopics] = useState([])

  useEffect(() => { if (slot.subjectId) loadTopics(slot.subjectId) }, [slot.subjectId])

  async function loadTopics(subjectId) {
    const t = await db.topics.where('subjectId').equals(subjectId).toArray()
    setTopics(t)
  }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'oklch(65% .18 240 / .2)', borderRadius: '20px', padding: '3px 10px', border: '1px solid oklch(65% .18 240 / .3)' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: 'oklch(75% .15 240)' }}>
              {slot.title ? slot.title : `Study ${idx + 1}`}
            </p>
          </div>
          {slot.plannedMins > 0 && (
            <p style={{ fontSize: '11px', color: 'var(--muted-fg)' }}>({formatMins(slot.plannedMins)} planned)</p>
          )}
        </div>
        <button onClick={onDelete} style={{ background: 'oklch(68% .22 22 / .15)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trash2 size={13} color='var(--priority-high)' />
        </button>
      </div>

      <Label>Actual Hours</Label>
      <TextInput value={slot.actualHours} onChange={v => onUpdate({ ...slot, actualHours: v })} placeholder="e.g. 1.5" type="number" />

      <Label>Subject Studied</Label>
      {subjects.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '4px' }}>No subjects — add from Subjects screen first.</p>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {subjects.map(sub => (
            <button key={sub.id} onClick={() => {
              if (slot.subjectId === sub.id) { onUpdate({ ...slot, subjectId: null, subjectName: '', topicId: null, topicName: '' }); setTopics([]) }
              else { onUpdate({ ...slot, subjectId: sub.id, subjectName: sub.name, topicId: null, topicName: '' }); loadTopics(sub.id) }
            }} style={{
              padding: '6px 12px', borderRadius: '20px',
              border: `2px solid ${slot.subjectId === sub.id ? 'oklch(75% .15 240)' : 'transparent'}`,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '600',
              background: slot.subjectId === sub.id ? 'oklch(65% .18 240 / .2)' : 'var(--surface)',
              color: slot.subjectId === sub.id ? 'oklch(75% .15 240)' : 'var(--muted-fg)',
            }}>{sub.name}</button>
          ))}
        </div>
      )}

      {slot.subjectId && topics.length > 0 && (
        <>
          <Label>Topics Studied</Label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {topics.map(t => {
              const selectedIds = Array.isArray(slot.topicIds) ? slot.topicIds : (slot.topicId ? [slot.topicId] : [])
              const isSelected = selectedIds.includes(t.id)
              return (
                <button key={t.id} onClick={() => {
                  const newIds = isSelected ? selectedIds.filter(id => id !== t.id) : [...selectedIds, t.id]
                  const newNames = topics.filter(tp => newIds.includes(tp.id)).map(tp => tp.name)
                  onUpdate({ ...slot, topicIds: newIds, topicNames: newNames, topicId: newIds[0] || null, topicName: newNames[0] || '' })
                }} style={{
                  padding: '6px 12px', borderRadius: '20px',
                  border: `2px solid ${isSelected ? 'oklch(75% .12 280)' : 'transparent'}`,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '600',
                  background: isSelected ? 'oklch(65% .15 280 / .2)' : 'var(--surface)',
                  color: isSelected ? 'oklch(75% .12 280)' : 'var(--muted-fg)',
                }}>{t.name}</button>
              )
            })}
          </div>
        </>
      )}

      <Label>What did you do?</Label>
      <Chips options={ACTIVITY_OPTIONS} value={slot.activities || []} onChange={v => onUpdate({ ...slot, activities: v })} multi />

      <Label>Major Blockers</Label>
      <TextInput value={slot.blockers || ''} onChange={v => onUpdate({ ...slot, blockers: v })} placeholder="e.g. Couldn't focus, interruptions" />

      <Label>Satisfaction (1–10)</Label>
      <SatisfactionRow value={slot.satisfaction || 0} onChange={v => onUpdate({ ...slot, satisfaction: v })} color='oklch(65% .18 240)' />
    </div>
  )
}

export default function FeedbackScreen({ onSave }) {
  const today = localDateString()
  const [open, setOpen] = useState('Study')
  const [subjects, setSubjects] = useState([])
  const [studySlots, setStudySlots] = useState([])
  const [studyDone, setStudyDone] = useState(false)
  const [office, setOffice] = useState({ actualHours: '', workTypes: [], meetingsCount: '', blockers: '', satisfaction: 0 })
  const [officeDone, setOfficeDone] = useState(false)
  const [exercise, setExercise] = useState({ plannedDuration: '', actualDuration: '', exerciseType: '', feel: '', satisfaction: 0 })
  const [exerciseDone, setExerciseDone] = useState(false)
  const [reflection, setReflection] = useState({ overallSatisfaction: 0 })
  const [reflectionDone, setReflectionDone] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try { const subs = await db.subjects.toArray(); setSubjects(subs) } catch {}
    try {
      const rec = await db.feedback?.get?.(today)
      if (rec) {
        if (rec.studySlots) { setStudySlots(rec.studySlots); setStudyDone(true) }
        if (rec.office)     { setOffice(rec.office);         setOfficeDone(true) }
        if (rec.exercise)   { setExercise(rec.exercise);     setExerciseDone(true) }
        if (rec.reflection) { setReflection(rec.reflection); setReflectionDone(true) }
        return
      }
    } catch {}

    try {
      const dayRecord = await db.days.get(today)
      const dt = dayRecord?.dayType || 'Normal Day'
      const allTemplates = await db.tasks.where('date').equals('template').toArray()
      const todayTemplates = allTemplates.filter(t => t.dayTypeTemplate === dt)
      const todayReal = await db.tasks.where('date').equals(today).toArray()
      const extraTasks = todayReal.filter(t => t.fromTemplateId == null)
      const allTodayTasks = [...todayTemplates, ...extraTasks]

      const studyTasks = allTodayTasks.filter(t => t.tag === 'Study')
      if (studyTasks.length > 0) {
        const slots = studyTasks.map(task => {
          let plannedMins = 0
          if (task.startTime && task.endTime) {
            const [sh, sm] = task.startTime.split(':').map(Number)
            const [eh, em] = task.endTime.split(':').map(Number)
            let mins = (eh * 60 + em) - (sh * 60 + sm)
            if (mins <= 0) mins += 24 * 60
            plannedMins = Math.max(0, mins)
          }
          return {
            taskId: task.id, title: task.title, plannedMins,
            subjectId: task.subjectId || null, subjectName: task.subjectName || '',
            topicId: task.topicId || null, topicName: task.topicName || '',
            topicIds: task.topicId ? [task.topicId] : [],
            topicNames: task.topicName ? [task.topicName] : [],
            actualHours: '', activities: [], blockers: '', satisfaction: 0,
          }
        })
        setStudySlots(slots)
      }

      const exTask = allTodayTasks.find(t => t.tag === 'Exercise' && t.startTime && t.endTime)
      if (exTask) {
        const [sh, sm] = exTask.startTime.split(':').map(Number)
        const [eh, em] = exTask.endTime.split(':').map(Number)
        let mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins <= 0) mins += 24 * 60
        if (mins > 0) setExercise(p => ({ ...p, plannedDuration: (mins / 60).toFixed(1) }))
      }

      const officeTasks = allTodayTasks.filter(t => t.tag === 'Office')
      const officeMins = officeTasks.reduce((sum, t) => {
        if (!t.startTime || !t.endTime) return sum
        const [sh, sm] = t.startTime.split(':').map(Number)
        const [eh, em] = t.endTime.split(':').map(Number)
        let mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins <= 0) mins += 24 * 60
        return sum + mins
      }, 0)
      if (officeMins > 0) setOffice(p => ({ ...p, plannedHours: (officeMins / 60).toFixed(1) }))
    } catch (e) { console.log('loadAll error:', e) }
  }

  async function syncSubjectsToLectures(slots) {
    try {
      const now = new Date().toISOString()
      for (const slot of slots) {
        if (!slot.subjectId) continue
        const topics = await db.topics.where('subjectId').equals(slot.subjectId).toArray()
        for (const topic of topics) {
          const lectures = slot.topicId
            ? await db.lectures.where('topicId').equals(slot.topicId).toArray()
            : await db.lectures.where('topicId').equals(topic.id).toArray()
          for (const lec of lectures) {
            const updates = { lastStudied: now }
            if (slot.activities?.includes('Lecture Watched')) updates.watched = true
            if (slot.activities?.includes('Notes Made')) updates.notesMade = true
            if (slot.activities?.includes('Questions Solved')) updates.questionsSolved = true
            if (slot.activities?.includes('Revised')) updates.revisionDone = true
            await db.lectures.update(lec.id, updates)
          }
        }
      }
    } catch (e) { console.log('syncSubjectsToLectures error:', e) }
  }

  async function calculateBonusPoints(feedbackRecord) {
    let bonus = 0
    try {
      const allFeedback = await db.feedback.toArray()
      let streak = 0
      for (let i = 0; ; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds = localDateString(d)
        const rec = ds === today ? feedbackRecord : allFeedback.find(f => f.date === ds)
        const totalActual = (rec?.studySlots || []).reduce((s, sl) => s + (parseFloat(sl.actualHours) || 0), 0)
        if (!rec || totalActual <= 0) break
        streak++
      }
      bonus += Math.floor(streak / 7) * 20
    } catch {}
    try {
      const totalPlanned = studySlots.reduce((s, sl) => s + (sl.plannedMins / 60 || 0), 0)
      const totalActual = studySlots.reduce((s, sl) => s + (parseFloat(sl.actualHours) || 0), 0)
      if (totalActual - totalPlanned > 1) {
        const todayTasks = await db.tasks.where('date').equals(today).toArray()
        const taskPoints = todayTasks.filter(t => t.completed).reduce((sum, t) => sum + (t.points || 0), 0)
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
      updated.studySlots = studySlots
      const totalActual = studySlots.reduce((s, sl) => s + (parseFloat(sl.actualHours) || 0), 0)
      const totalPlanned = studySlots.reduce((s, sl) => s + (sl.plannedMins / 60 || 0), 0)
      updated.study = { actualHours: totalActual.toFixed(1), plannedHours: totalPlanned.toFixed(1), subjects: [...new Set(studySlots.map(s => s.subjectName).filter(Boolean))] }
      setStudyDone(true)
      await syncSubjectsToLectures(studySlots)
    }
    if (section === 'Office')     { updated.office = office;         setOfficeDone(true) }
    if (section === 'Exercise')   { updated.exercise = exercise;     setExerciseDone(true) }
    if (section === 'Reflection') {
      updated.reflection = reflection; setReflectionDone(true)
      updated.bonusPoints = await calculateBonusPoints(updated)
    }

    try { await db.feedback?.put?.(updated) } catch {}
    setOpen(null)
    onSave?.('feedback', updated)
  }

  function addSlot() {
    setStudySlots(prev => [...prev, { taskId: null, title: '', plannedMins: 0, subjectId: null, subjectName: '', topicId: null, topicName: '', actualHours: '', activities: [], blockers: '', satisfaction: 0 }])
  }
  function updateSlot(idx, updated) { setStudySlots(prev => prev.map((s, i) => i === idx ? updated : s)) }
  function deleteSlot(idx) { setStudySlots(prev => prev.filter((_, i) => i !== idx)) }

  const allDone = studyDone && officeDone && exerciseDone && reflectionDone
  const toggle = (key) => setOpen(o => o === key ? null : key)

  const saveBtn = {
    marginTop: '14px', width: '100%', padding: '12px',
    background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', border: 'none',
    borderRadius: '12px', fontFamily: 'Inter, sans-serif',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-fg)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>Daily Feedback</p>
        <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--fg)' }}>{formatDate(today)}</p>
      </div>

      {allDone && (
        <div style={{ background: 'oklch(65% .16 155 / .12)', border: '1.5px solid oklch(65% .16 155 / .4)', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={22} color='oklch(75% .14 155)' />
          <div>
            <p style={{ fontSize: '14px', fontWeight: '700', color: 'oklch(75% .14 155)' }}>All feedback submitted!</p>
            <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '2px' }}>Head to Insights for your AI analysis.</p>
          </div>
        </div>
      )}

      <Section title="Study Feedback" icon="📚" colorKey="Study" isOpen={open === 'Study'} onToggle={() => toggle('Study')} isDone={studyDone}>
        {studySlots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginBottom: '12px' }}>No study slots yet.</p>
          </div>
        ) : studySlots.map((slot, idx) => (
          <StudySlot key={idx} slot={slot} idx={idx} subjects={subjects} onUpdate={(u) => updateSlot(idx, u)} onDelete={() => deleteSlot(idx)} />
        ))}
        <button onClick={addSlot} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px dashed oklch(65% .18 240 / .4)', background: 'oklch(65% .18 240 / .08)', color: 'oklch(75% .15 240)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
          <Plus size={16} /> Add Study Slot
        </button>
        <button onClick={() => saveSection('Study')} style={saveBtn}>Save Study Feedback</button>
      </Section>

      <Section title="Office Feedback" icon="💼" colorKey="Office" isOpen={open === 'Office'} onToggle={() => toggle('Office')} isDone={officeDone}>
        <Label>Actual Office Hours</Label>
        <TextInput value={office.actualHours} onChange={v => setOffice({ ...office, actualHours: v })} placeholder="e.g. 8" type="number" />
        <Label>Work Type</Label>
        <Chips options={WORK_TYPES} value={office.workTypes} onChange={v => setOffice({ ...office, workTypes: v })} multi />
        <Label>Number of Meetings</Label>
        <TextInput value={office.meetingsCount} onChange={v => setOffice({ ...office, meetingsCount: v })} placeholder="e.g. 4" type="number" />
        <Label>Major Blockers</Label>
        <TextInput value={office.blockers} onChange={v => setOffice({ ...office, blockers: v })} placeholder="e.g. Production issue escalation" />
        <Label>Satisfaction (1–10)</Label>
        <SatisfactionRow value={office.satisfaction} onChange={v => setOffice({ ...office, satisfaction: v })} color='oklch(65% .15 280)' />
        <button onClick={() => saveSection('Office')} style={saveBtn}>Save Office Feedback</button>
      </Section>

      <Section title="Exercise Feedback" icon="🏃" colorKey="Exercise" isOpen={open === 'Exercise'} onToggle={() => toggle('Exercise')} isDone={exerciseDone}>
        <Label>Planned Duration (hrs)</Label>
        <TextInput value={exercise.plannedDuration} onChange={v => setExercise({ ...exercise, plannedDuration: v })} placeholder="e.g. 1" type="number" />
        <Label>Actual Duration (hrs)</Label>
        <TextInput value={exercise.actualDuration} onChange={v => setExercise({ ...exercise, actualDuration: v })} placeholder="e.g. 0.5" type="number" />
        <Label>Exercise Type</Label>
        <TextInput value={exercise.exerciseType} onChange={v => setExercise({ ...exercise, exerciseType: v })} placeholder="e.g. Running, Yoga, Gym" />
        <Label>How Did You Feel?</Label>
        <Chips options={FEEL_OPTIONS} value={exercise.feel} onChange={v => setExercise({ ...exercise, feel: v })} />
        <Label>Satisfaction (1–10)</Label>
        <SatisfactionRow value={exercise.satisfaction} onChange={v => setExercise({ ...exercise, satisfaction: v })} color='oklch(65% .16 155)' />
        <button onClick={() => saveSection('Exercise')} style={saveBtn}>Save Exercise Feedback</button>
      </Section>

      <Section title="End of Day Reflection" icon="🌙" colorKey="Reflection" isOpen={open === 'Reflection'} onToggle={() => toggle('Reflection')} isDone={reflectionDone}>
        <Label>Overall Satisfaction (1–10)</Label>
        <SatisfactionRow value={reflection.overallSatisfaction} onChange={v => setReflection({ ...reflection, overallSatisfaction: v })} color='var(--primary)' />
        <button onClick={() => saveSection('Reflection')} style={saveBtn}>Save Reflection</button>
      </Section>
    </div>
  )
}