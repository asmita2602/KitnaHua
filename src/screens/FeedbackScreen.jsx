import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Plus, X } from 'lucide-react'
import { db } from '../db'

function getTodayString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(dateStr) {
  const parts = dateStr.split('-').map(Number)
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

const WORK_TYPES = ['Meetings', 'Access Requests', 'Development', 'Scripting', 'Documentation']
const FEEL_OPTIONS = ['Energetic', 'Normal', 'Tired']

const SECTION_COLORS = {
  Study: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', dot: '#3b82f6' },
  Office: { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', dot: '#6366f1' },
  Exercise: { bg: '#dcfce7', border: '#86efac', text: '#14532d', dot: '#22c55e' },
  Reflection: { bg: '#fef9c3', border: '#fde047', text: '#854d0e', dot: '#eab308' },
}

function SatisfactionSlider({ value, onChange, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: value === n ? `2px solid ${color}` : '2px solid #e2e8f0',
            background: value >= n ? color : '#f8fafc',
            color: value >= n ? '#fff' : '#94a3b8',
            fontSize: '11px', fontWeight: '800',
            cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
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

function AccordionSection({ title, icon, colorKey, isOpen, onToggle, children, isDone }) {
  const c = SECTION_COLORS[colorKey]
  return (
    <div style={{
      background: '#fff', border: isDone ? `2px solid ${c.border}` : '1px solid #e2e8f0',
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
          <span style={{ fontSize: '15px', fontWeight: '800', color: isDone ? c.text : '#0f172a' }}>
            {icon} {title}
          </span>
          {isDone && (
            <span style={{
              fontSize: '11px', fontWeight: '700', color: c.text,
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: '20px', padding: '2px 8px',
            }}>Done ✓</span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} color='#94a3b8' /> : <ChevronDown size={18} color='#94a3b8' />}
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 16px' }}>{children}</div>
      )}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <p style={{
      fontSize: '11px', fontWeight: '800', color: '#64748b',
      marginBottom: '6px', marginTop: '14px',
      fontFamily: 'Nunito, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>{children}</p>
  )
}

function InputBox({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: '10px',
        border: '1px solid #e2e8f0', fontSize: '14px',
        fontFamily: 'Nunito, sans-serif', outline: 'none',
        color: '#0f172a', boxSizing: 'border-box', background: '#f8fafc',
      }}
    />
  )
}

function ChipSelect({ options, value, onChange, multiSelect = false }) {
  const handleClick = (opt) => {
    if (multiSelect) {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt])
    } else {
      onChange(opt)
    }
  }
  const isSelected = (opt) => multiSelect ? (Array.isArray(value) && value.includes(opt)) : value === opt
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => handleClick(opt)} style={{
          padding: '7px 14px', borderRadius: '20px', border: 'none',
          cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
          fontSize: '12px', fontWeight: '700',
          background: isSelected(opt) ? '#0f172a' : '#f1f5f9',
          color: isSelected(opt) ? '#fff' : '#64748b',
        }}>{opt}</button>
      ))}
    </div>
  )
}

// Single subject study entry component
function StudySubjectEntry({ entry, index, onUpdate, onRemove, allSubjects, canRemove }) {
  const [topics, setTopics] = useState([])
  const [lectures, setLectures] = useState([])

  useEffect(() => {
    if (entry.subjectId) loadTopics(entry.subjectId)
  }, [entry.subjectId])

  useEffect(() => {
    if (entry.topicId) loadLectures(entry.topicId)
  }, [entry.topicId])

  async function loadTopics(subjectId) {
    const t = await db.topics.where('subjectId').equals(subjectId).toArray()
    setTopics(t)
  }

  async function loadLectures(topicId) {
    const l = await db.lectures.where('topicId').equals(topicId).toArray()
    setLectures(l)
  }

  function toggleLectureField(lectureId, field) {
    const updated = entry.lectureUpdates?.map(l =>
      l.id === lectureId ? { ...l, [field]: !l[field] } : l
    ) || []
    onUpdate(index, { ...entry, lectureUpdates: updated })
  }

  function handleSubjectSelect(sub) {
    onUpdate(index, {
      ...entry,
      subjectId: sub.id,
      subjectName: sub.name,
      topicId: null,
      topicName: '',
      lectureUpdates: [],
    })
    setTopics([])
    setLectures([])
  }

  function handleTopicSelect(topic) {
    const lectureUpdates = lectures.map(l => ({
      id: l.id,
      name: l.name,
      watched: l.watched,
      notesMade: l.notesMade,
      questionsSolved: l.questionsSolved,
      revisionDone: l.revisionDone,
    }))
    onUpdate(index, {
      ...entry,
      topicId: topic.id,
      topicName: topic.name,
      lectureUpdates,
    })
  }

  const lectureFields = [
    { key: 'watched', label: '👁 Watched', color: '#3b82f6' },
    { key: 'notesMade', label: '📝 Notes', color: '#8b5cf6' },
    { key: 'questionsSolved', label: '❓ Questions', color: '#f97316' },
    { key: 'revisionDone', label: '🔄 Revision', color: '#22c55e' },
  ]

  return (
    <div style={{
      background: '#f8fafc', borderRadius: '12px',
      padding: '14px', marginBottom: '12px',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
          Study Session {index + 1}
        </p>
        {canRemove && (
          <button onClick={() => onRemove(index)} style={{
            background: '#fff5f5', border: 'none', borderRadius: '6px',
            width: '26px', height: '26px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={13} color='#ef4444' />
          </button>
        )}
      </div>

      <FieldLabel>Subject</FieldLabel>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {allSubjects.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Add subjects from Subjects screen first.</p>
        ) : allSubjects.map(sub => (
          <button key={sub.id} onClick={() => handleSubjectSelect(sub)} style={{
            padding: '6px 12px', borderRadius: '20px',
            border: `2px solid ${entry.subjectId === sub.id ? '#3b82f6' : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
            fontSize: '12px', fontWeight: '700',
            background: entry.subjectId === sub.id ? '#dbeafe' : '#fff',
            color: entry.subjectId === sub.id ? '#1e40af' : '#64748b',
          }}>{sub.name}</button>
        ))}
      </div>

      {entry.subjectId && (
        <>
          <FieldLabel>Actual Hours</FieldLabel>
          <InputBox value={entry.actualHours}
            onChange={v => onUpdate(index, { ...entry, actualHours: v })}
            placeholder="e.g. 1.5" type="number" />

          {topics.length > 0 && (
            <>
              <FieldLabel>Topic Studied</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {topics.map(topic => (
                  <button key={topic.id} onClick={() => handleTopicSelect(topic)} style={{
                    padding: '6px 12px', borderRadius: '20px',
                    border: `2px solid ${entry.topicId === topic.id ? '#8b5cf6' : 'transparent'}`,
                    cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                    fontSize: '12px', fontWeight: '700',
                    background: entry.topicId === topic.id ? '#ede9fe' : '#fff',
                    color: entry.topicId === topic.id ? '#5b21b6' : '#64748b',
                  }}>{topic.name}</button>
                ))}
              </div>
            </>
          )}

          {entry.topicId && entry.lectureUpdates?.length > 0 && (
            <>
              <FieldLabel>Lecture Progress</FieldLabel>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {entry.lectureUpdates.map(lec => (
                  <div key={lec.id} style={{
                    background: '#fff', borderRadius: '10px', padding: '10px 12px',
                    marginBottom: '8px', border: '1px solid #e2e8f0',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      {lec.name}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {lectureFields.map(f => (
                        <button key={f.key} onClick={() => toggleLectureField(lec.id, f.key)} style={{
                          padding: '5px 10px', borderRadius: '20px', border: 'none',
                          cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                          fontSize: '11px', fontWeight: '700',
                          background: lec[f.key] ? f.color : '#f1f5f9',
                          color: lec[f.key] ? '#fff' : '#94a3b8',
                        }}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <FieldLabel>Blockers</FieldLabel>
          <InputBox value={entry.blockers}
            onChange={v => onUpdate(index, { ...entry, blockers: v })}
            placeholder="e.g. Got distracted, calls" />
        </>
      )}
    </div>
  )
}

export default function FeedbackScreen() {
  const today = getTodayString()
  const [openSection, setOpenSection] = useState('Study')
  const [allSubjects, setAllSubjects] = useState([])

  const [studySessions, setStudySessions] = useState([{
    subjectId: null, subjectName: '', topicId: null, topicName: '',
    actualHours: '', blockers: '', lectureUpdates: [],
  }])

  const [officeFeedback, setOfficeFeedback] = useState({
    actualHours: '', workTypes: [], meetingsCount: '', blockers: '', satisfaction: 0,
  })
  const [exerciseFeedback, setExerciseFeedback] = useState({
    plannedDuration: '', actualDuration: '', exerciseType: '', feel: '', satisfaction: 0,
  })
  const [reflection, setReflection] = useState({
    overallSatisfaction: 0, biggestAchievement: '', biggestChallenge: '',
  })
  const [studySatisfaction, setStudySatisfaction] = useState(0)

  const [studyDone, setStudyDone] = useState(false)
  const [officeDone, setOfficeDone] = useState(false)
  const [exerciseDone, setExerciseDone] = useState(false)
  const [reflectionDone, setReflectionDone] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const subs = await db.subjects.toArray()
    setAllSubjects(subs)

    // Load today's study tasks to pre-populate sessions
    const todayTasks = await db.tasks
      .where('date').equals(today)
      .toArray()
    const studyTasks = todayTasks.filter(t => t.tag === 'Study' && t.subjectId)

    if (studyTasks.length > 0) {
      const sessions = studyTasks.map(t => ({
        subjectId: t.subjectId,
        subjectName: t.subjectName || '',
        topicId: t.topicId || null,
        topicName: t.topicName || '',
        actualHours: '',
        blockers: '',
        lectureUpdates: [],
        taskId: t.id,
      }))
      setStudySessions(sessions)
    }

    // Load existing feedback
    try {
      const record = await db.feedback?.get?.(today)
      if (record) {
        if (record.studySessions) { setStudySessions(record.studySessions); setStudyDone(true) }
        if (record.studySatisfaction) setStudySatisfaction(record.studySatisfaction)
        if (record.office) { setOfficeFeedback(record.office); setOfficeDone(true) }
        if (record.exercise) { setExerciseFeedback(record.exercise); setExerciseDone(true) }
        if (record.reflection) { setReflection(record.reflection); setReflectionDone(true) }
      }
    } catch {}

    // Pre-fill exercise planned from templates
    const dayRecord = await db.days.get(today)
    const dayType = dayRecord?.dayType || 'Normal Day'
    const templateBlocks = await db.tasks.where('date').equals('template').toArray()
    const forToday = templateBlocks.filter(b => b.dayTypeTemplate === dayType)
    const exMins = forToday.filter(b => b.tag === 'Exercise').reduce((sum, b) => {
      if (!b.startTime || !b.endTime) return sum
      const [sh, sm] = b.startTime.split(':').map(Number)
      const [eh, em] = b.endTime.split(':').map(Number)
      return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
    }, 0)
    if (exMins > 0) setExerciseFeedback(p => ({ ...p, plannedDuration: (exMins / 60).toFixed(1) }))
  }

  function updateSession(index, updated) {
    setStudySessions(prev => prev.map((s, i) => i === index ? updated : s))
  }

  function removeSession(index) {
    setStudySessions(prev => prev.filter((_, i) => i !== index))
  }

  function addSession() {
    setStudySessions(prev => [...prev, {
      subjectId: null, subjectName: '', topicId: null, topicName: '',
      actualHours: '', blockers: '', lectureUpdates: [],
    }])
  }

  async function saveStudy() {
    // Save lecture updates to db
    for (const session of studySessions) {
      if (session.lectureUpdates?.length > 0) {
        for (const lec of session.lectureUpdates) {
          await db.lectures.update(lec.id, {
            watched: lec.watched,
            notesMade: lec.notesMade,
            questionsSolved: lec.questionsSolved,
            revisionDone: lec.revisionDone,
            lastStudied: lec.watched ? new Date().toISOString() : undefined,
          })
        }
      }
    }

    let existing = {}
    try { existing = (await db.feedback?.get?.(today)) || {} } catch {}
    await db.feedback?.put?.({
      date: today, ...existing,
      studySessions, studySatisfaction,
    })
    setStudyDone(true)
    setOpenSection(null)
  }

  async function saveSection(section) {
    let existing = {}
    try { existing = (await db.feedback?.get?.(today)) || {} } catch {}
    const updated = { date: today, ...existing }
    if (section === 'Office') { updated.office = officeFeedback; setOfficeDone(true) }
    if (section === 'Exercise') { updated.exercise = exerciseFeedback; setExerciseDone(true) }
    if (section === 'Reflection') { updated.reflection = reflection; setReflectionDone(true) }
    try { await db.feedback?.put?.(updated) } catch {}
    setOpenSection(null)
  }

  const allDone = studyDone && officeDone && exerciseDone && reflectionDone

  return (
    <div style={{ padding: '16px', paddingBottom: '32px', fontFamily: 'Nunito, sans-serif' }}>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Daily Feedback</p>
        <p style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>{formatDate(today)}</p>
      </div>

      {allDone && (
        <div style={{
          background: '#f0fdf4', border: '2px solid #4ade80', borderRadius: '14px',
          padding: '14px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <CheckCircle size={22} color='#22c55e' />
          <div>
            <p style={{ fontSize: '14px', fontWeight: '800', color: '#14532d' }}>All feedback submitted!</p>
            <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '2px' }}>Head to Insights for AI analysis.</p>
          </div>
        </div>
      )}

      {/* Study Section */}
      <AccordionSection
        title="Study Feedback" icon="📚" colorKey="Study"
        isOpen={openSection === 'Study'}
        onToggle={() => setOpenSection(openSection === 'Study' ? null : 'Study')}
        isDone={studyDone}
      >
        {studySessions.map((session, idx) => (
          <StudySubjectEntry
            key={idx} entry={session} index={idx}
            onUpdate={updateSession} onRemove={removeSession}
            allSubjects={allSubjects} canRemove={studySessions.length > 1}
          />
        ))}

        <button onClick={addSession} style={{
          width: '100%', padding: '10px', borderRadius: '10px',
          border: '2px dashed #93c5fd', background: '#eff6ff',
          color: '#3b82f6', fontSize: '13px', fontWeight: '700',
          cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          marginBottom: '14px',
        }}>
          <Plus size={15} /> Add Another Subject
        </button>

        <FieldLabel>Overall Study Satisfaction (1–10)</FieldLabel>
        <SatisfactionSlider value={studySatisfaction}
          onChange={setStudySatisfaction} color='#3b82f6' />

        <button onClick={saveStudy} style={{
          marginTop: '18px', width: '100%', padding: '12px',
          background: '#0f172a', color: '#fff', border: 'none',
          borderRadius: '12px', fontFamily: 'Nunito, sans-serif',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        }}>Save Study Feedback</button>
      </AccordionSection>

      {/* Office Section */}
      <AccordionSection
        title="Office Feedback" icon="💼" colorKey="Office"
        isOpen={openSection === 'Office'}
        onToggle={() => setOpenSection(openSection === 'Office' ? null : 'Office')}
        isDone={officeDone}
      >
        <FieldLabel>Actual Office Hours</FieldLabel>
        <InputBox value={officeFeedback.actualHours}
          onChange={v => setOfficeFeedback({ ...officeFeedback, actualHours: v })}
          placeholder="e.g. 8" type="number" />

        <FieldLabel>Work Type</FieldLabel>
        <ChipSelect options={WORK_TYPES} value={officeFeedback.workTypes}
          onChange={v => setOfficeFeedback({ ...officeFeedback, workTypes: v })} multiSelect />

        <FieldLabel>Number of Meetings</FieldLabel>
        <InputBox value={officeFeedback.meetingsCount}
          onChange={v => setOfficeFeedback({ ...officeFeedback, meetingsCount: v })}
          placeholder="e.g. 4" type="number" />

        <FieldLabel>Major Blockers</FieldLabel>
        <InputBox value={officeFeedback.blockers}
          onChange={v => setOfficeFeedback({ ...officeFeedback, blockers: v })}
          placeholder="e.g. Production issue escalation" />

        <FieldLabel>Satisfaction (1–10)</FieldLabel>
        <SatisfactionSlider value={officeFeedback.satisfaction}
          onChange={v => setOfficeFeedback({ ...officeFeedback, satisfaction: v })}
          color='#6366f1' />

        <button onClick={() => saveSection('Office')} style={{
          marginTop: '18px', width: '100%', padding: '12px',
          background: '#0f172a', color: '#fff', border: 'none',
          borderRadius: '12px', fontFamily: 'Nunito, sans-serif',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        }}>Save Office Feedback</button>
      </AccordionSection>

      {/* Exercise Section */}
      <AccordionSection
        title="Exercise Feedback" icon="🏃" colorKey="Exercise"
        isOpen={openSection === 'Exercise'}
        onToggle={() => setOpenSection(openSection === 'Exercise' ? null : 'Exercise')}
        isDone={exerciseDone}
      >
        <FieldLabel>Planned Duration (hrs)</FieldLabel>
        <InputBox value={exerciseFeedback.plannedDuration}
          onChange={v => setExerciseFeedback({ ...exerciseFeedback, plannedDuration: v })}
          placeholder="e.g. 1" type="number" />

        <FieldLabel>Actual Duration (hrs)</FieldLabel>
        <InputBox value={exerciseFeedback.actualDuration}
          onChange={v => setExerciseFeedback({ ...exerciseFeedback, actualDuration: v })}
          placeholder="e.g. 0.5" type="number" />

        <FieldLabel>Exercise Type</FieldLabel>
        <InputBox value={exerciseFeedback.exerciseType}
          onChange={v => setExerciseFeedback({ ...exerciseFeedback, exerciseType: v })}
          placeholder="e.g. Running, Yoga, Gym" />

        <FieldLabel>How Did You Feel?</FieldLabel>
        <ChipSelect options={FEEL_OPTIONS} value={exerciseFeedback.feel}
          onChange={v => setExerciseFeedback({ ...exerciseFeedback, feel: v })} />

        <FieldLabel>Satisfaction (1–10)</FieldLabel>
        <SatisfactionSlider value={exerciseFeedback.satisfaction}
          onChange={v => setExerciseFeedback({ ...exerciseFeedback, satisfaction: v })}
          color='#22c55e' />

        <button onClick={() => saveSection('Exercise')} style={{
          marginTop: '18px', width: '100%', padding: '12px',
          background: '#0f172a', color: '#fff', border: 'none',
          borderRadius: '12px', fontFamily: 'Nunito, sans-serif',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        }}>Save Exercise Feedback</button>
      </AccordionSection>

      {/* Reflection Section */}
      <AccordionSection
        title="End of Day Reflection" icon="🌙" colorKey="Reflection"
        isOpen={openSection === 'Reflection'}
        onToggle={() => setOpenSection(openSection === 'Reflection' ? null : 'Reflection')}
        isDone={reflectionDone}
      >
        <FieldLabel>Overall Satisfaction (1–10)</FieldLabel>
        <SatisfactionSlider value={reflection.overallSatisfaction}
          onChange={v => setReflection({ ...reflection, overallSatisfaction: v })}
          color='#eab308' />

        <FieldLabel>Biggest Achievement</FieldLabel>
        <textarea value={reflection.biggestAchievement}
          onChange={e => setReflection({ ...reflection, biggestAchievement: e.target.value })}
          placeholder="What went well today?" rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '10px',
            border: '1px solid #e2e8f0', fontSize: '14px',
            fontFamily: 'Nunito, sans-serif', outline: 'none',
            color: '#0f172a', resize: 'none', background: '#f8fafc',
            boxSizing: 'border-box',
          }}
        />

        <FieldLabel>Biggest Challenge</FieldLabel>
        <textarea value={reflection.biggestChallenge}
          onChange={e => setReflection({ ...reflection, biggestChallenge: e.target.value })}
          placeholder="What was hard today?" rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '10px',
            border: '1px solid #e2e8f0', fontSize: '14px',
            fontFamily: 'Nunito, sans-serif', outline: 'none',
            color: '#0f172a', resize: 'none', background: '#f8fafc',
            boxSizing: 'border-box',
          }}
        />

        <button onClick={() => saveSection('Reflection')} style={{
          marginTop: '18px', width: '100%', padding: '12px',
          background: '#0f172a', color: '#fff', border: 'none',
          borderRadius: '12px', fontFamily: 'Nunito, sans-serif',
          fontSize: '14px', fontWeight: '700', cursor: 'pointer',
        }}>Save Reflection</button>
      </AccordionSection>
    </div>
  )
}