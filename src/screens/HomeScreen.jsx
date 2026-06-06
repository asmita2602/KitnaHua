import { useState, useEffect, useRef } from 'react'
import { Plus, Clock } from 'lucide-react'
import { db } from '../db'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_COLORS = {
  'Normal Day':      { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'High Pressure Day': { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  'Travel Day':      { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  'Weekend Day':     { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
}

const PRIORITY_COLORS = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' }

const TAG_COLORS = {
  Study:    { bg: '#dbeafe', text: '#1e40af' },
  Office:   { bg: '#e0e7ff', text: '#3730a3' },
  Exercise: { bg: '#dcfce7', text: '#14532d' },
  Personal: { bg: '#fce7f3', text: '#9d174d' },
  Other:    { bg: '#f1f5f9', text: '#475569' },
}

// ── KEY FIX: local date string, not UTC ──────────────────────────────────────
function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysToStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)   // local midnight — no timezone shift
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

function getDefaultDayType(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6 ? 'Weekend Day' : 'Normal Day'
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDuration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  return mins < 60 ? `${mins}m` : `${Math.round((mins / 60) * 10) / 10}h`
}

export default function HomeScreen({ onPointsUpdate }) {
  const todayStr = localDateString()
  const [currentDate, setCurrentDate] = useState(todayStr)
  const [dayType, setDayType] = useState(getDefaultDayType(todayStr))
  const [showDropdown, setShowDropdown] = useState(false)
  const [tasks, setTasks] = useState([])
  const [showAddTask, setShowAddTask] = useState(false)
  const [subjectsList, setSubjectsList] = useState([])
  const [topicsList, setTopicsList] = useState([])
  const [newTask, setNewTask] = useState({
    title: '', description: '', startTime: '', endTime: '',
    priority: 'Medium', points: 20, tag: 'Study',
    subjectId: null, subjectName: '', topicId: null, topicName: '',
  })

  // swipe tracking — using a ref so values are always current inside event handlers
  const swipeRef = useRef({ startX: 0, startY: 0, active: false })

  useEffect(() => { loadDayData() }, [currentDate])
  useEffect(() => { loadSubjects() }, [])

  async function loadDayData() {
    const dayRecord = await db.days.get(currentDate)
    setDayType(dayRecord?.dayType || getDefaultDayType(currentDate))
    const dayTasks = await db.tasks.where('date').equals(currentDate).toArray()
    setTasks(dayTasks)
  }

  async function loadSubjects() {
    const subs = await db.subjects.toArray()
    setSubjectsList(subs)
  }

  async function loadTopicsForSubject(subjectId) {
    const topics = await db.topics.where('subjectId').equals(subjectId).toArray()
    setTopicsList(topics)
  }

  async function handleDayTypeChange(type) {
    setDayType(type)
    setShowDropdown(false)
    await db.days.put({ date: currentDate, dayType: type })
  }

  async function handleAddTask() {
    if (!newTask.title.trim()) return
    await db.tasks.add({ ...newTask, points: Number(newTask.points), date: currentDate, completed: false, feedbackDone: false })
    setNewTask({ title: '', description: '', startTime: '', endTime: '', priority: 'Medium', points: 20, tag: 'Study' })
    setShowAddTask(false)
    loadDayData()
    onPointsUpdate?.()
  }

  async function handleQuickComplete(taskId) {
    await db.tasks.update(taskId, { completed: true })
    loadDayData(); onPointsUpdate?.()
  }

  async function handleUndoComplete(taskId) {
    await db.tasks.update(taskId, { completed: false })
    loadDayData(); onPointsUpdate?.()
  }

  function goToPrev() { setCurrentDate(d => addDaysToStr(d, -1)) }
  function goToNext() { setCurrentDate(d => addDaysToStr(d, 1)) }

  // Touch handlers on the header card
  function onTouchStart(e) {
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, active: true }
  }
  function onTouchEnd(e) {
    if (!swipeRef.current.active) return
    const dx = swipeRef.current.startX - e.changedTouches[0].clientX
    const dy = Math.abs(swipeRef.current.startY - e.changedTouches[0].clientY)
    swipeRef.current.active = false
    if (dy > 40) return // ignore vertical scrolls
    if (dx > 50) goToNext()
    else if (dx < -50) goToPrev()
  }

  const completedCount = tasks.filter(t => t.completed).length
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0
  const colors = DAY_TYPE_COLORS[dayType]
  const circumference = 2 * Math.PI * 36
  const strokeDash = (progress / 100) * circumference
  const isToday = currentDate === todayStr

  return (
    <div style={{ padding: '16px', paddingBottom: '90px', fontFamily: 'Nunito, sans-serif' }}>

      {/* ── Header card — swipeable ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: '20px', padding: '16px', marginBottom: '14px', userSelect: 'none' }}
      >
        {/* Date row with tap-arrows */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button onClick={goToPrev} style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text, flexShrink: 0 }}>‹</button>

          <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
            <p style={{ fontSize: '13px', fontWeight: '800', color: colors.text, lineHeight: 1.3 }}>{formatDate(currentDate)}</p>
            {!isToday && (
              <button onClick={() => setCurrentDate(todayStr)} style={{ marginTop: '4px', fontSize: '11px', fontWeight: '700', color: colors.text, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Nunito, sans-serif' }}>
                Back to Today
              </button>
            )}
            <p style={{ fontSize: '10px', fontWeight: '600', color: colors.text, opacity: 0.5, marginTop: '2px' }}>← swipe or tap to navigate →</p>
          </div>

          <button onClick={goToNext} style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.text, flexShrink: 0 }}>›</button>
        </div>

        {/* Day type dropdown */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button onClick={() => setShowDropdown(!showDropdown)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.75)', border: `1.5px solid ${colors.border}`, borderRadius: '12px', padding: '8px 14px', cursor: 'pointer', fontWeight: '800', fontSize: '14px', color: colors.text, fontFamily: 'Nunito, sans-serif' }}>
            {dayType} <span style={{ fontSize: '11px' }}>▾</span>
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: '#fff', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.14)', overflow: 'hidden', minWidth: '190px' }}>
              {DAY_TYPES.map(type => (
                <button key={type} onClick={() => handleDayTypeChange(type)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', cursor: 'pointer', background: type === dayType ? DAY_TYPE_COLORS[type].bg : '#fff', color: DAY_TYPE_COLORS[type].text, fontWeight: type === dayType ? '800' : '600', fontSize: '14px', fontFamily: 'Nunito, sans-serif' }}>
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress ring ── */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #e2e8f0' }}>
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="44" cy="44" r="36" fill="none" stroke="#38bdf8" strokeWidth="8"
            strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 44 44)" />
          <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '16px', fontWeight: '900', fill: '#0f172a', fontFamily: 'Nunito' }}>
            {progress}%
          </text>
        </svg>
        <div>
          <p style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{isToday ? "Today's Progress" : "Day's Progress"}</p>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{completedCount} of {tasks.length} tasks done</p>
        </div>
      </div>

      {/* ── Task list ── */}
      <p style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', marginBottom: '12px' }}>
        {isToday ? "Today's Schedule" : `${formatDate(currentDate).split(',')[0]}'s Schedule`}
      </p>

      {tasks.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '14px', fontWeight: '600' }}>No tasks yet. Tap + to add.</p>
        </div>
      ) : tasks.map(task => {
        const dur = formatDuration(task.startTime, task.endTime)
        return (
          <div key={task.id} style={{ background: task.completed ? '#f0fdf4' : '#fff', border: `1px solid ${task.completed ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: '14px', padding: '13px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: '2px', minWidth: '34px' }}>
              <Clock size={17} color='#94a3b8' />
              {dur && <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>{dur}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', textDecoration: task.completed ? 'line-through' : 'none', marginBottom: '3px', textTransform: 'capitalize' }}>{task.title}</p>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: TAG_COLORS[task.tag]?.text || '#475569' }}>{task.tag}</span>
                <span style={{ color: '#e2e8f0', fontSize: '10px' }}>●</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
                <span style={{ color: '#e2e8f0', fontSize: '10px' }}>●</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>{task.points} 🏆</span>
              </div>
            </div>
            <button onClick={() => task.completed ? handleUndoComplete(task.id) : handleQuickComplete(task.id)} style={{ width: '34px', height: '34px', borderRadius: '50%', border: `2px solid ${task.completed ? '#4ade80' : '#e2e8f0'}`, background: task.completed ? '#4ade80' : '#fff', color: task.completed ? '#fff' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '15px', fontWeight: '900' }}>
              {task.completed ? '✓' : ''}
            </button>
          </div>
        )
      })}

      {/* ── Add Task Modal ── */}
      {showAddTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddTask(false) }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '414px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '36px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 18px' }} />
            <p style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', marginBottom: '16px' }}>Add Task</p>

            {[
              { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. DSA Practice' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Optional' },
              { label: 'Start Time', key: 'startTime', type: 'time' },
              { label: 'End Time', key: 'endTime', type: 'time' },
              { label: 'Points', key: 'points', type: 'number', placeholder: '20' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field.label}</p>
                <input type={field.type} placeholder={field.placeholder} value={newTask[field.key]}
                  onChange={e => setNewTask({ ...newTask, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: '11px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', boxSizing: 'border-box', background: '#f8fafc' }} />
              </div>
            ))}

            <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {['High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setNewTask({ ...newTask, priority: p })} style={{ flex: 1, padding: '9px', borderRadius: '10px', border: `2px solid ${newTask.priority === p ? PRIORITY_COLORS[p] : '#e2e8f0'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: '800', background: newTask.priority === p ? PRIORITY_COLORS[p] : '#fff', color: newTask.priority === p ? '#fff' : '#94a3b8' }}>{p}</button>
              ))}
            </div>

             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: newTask.tag === 'Study' ? '14px' : '22px' }}>
              {['Study', 'Office', 'Exercise', 'Personal', 'Other'].map(tag => (
                <button key={tag} onClick={() => {
                  setNewTask({ ...newTask, tag, subjectId: null, subjectName: '', topicId: null, topicName: '' })
                  setTopicsList([])
                }} style={{ padding: '7px 14px', borderRadius: '20px', border: `2px solid ${newTask.tag === tag ? TAG_COLORS[tag].text : 'transparent'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700', background: newTask.tag === tag ? TAG_COLORS[tag].bg : '#f1f5f9', color: newTask.tag === tag ? TAG_COLORS[tag].text : '#94a3b8' }}>{tag}</button>
              ))}
            </div>

            {newTask.tag === 'Study' && (
              <div style={{ marginBottom: '22px' }}>
                <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject (optional)</p>
                {subjectsList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>
                    No subjects yet — add from Subjects screen first.
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {subjectsList.map(sub => (
                      <button key={sub.id}
                        onClick={() => {
                          if (newTask.subjectId === sub.id) {
                            setNewTask({ ...newTask, subjectId: null, subjectName: '', topicId: null, topicName: '' })
                            setTopicsList([])
                          } else {
                            setNewTask({ ...newTask, subjectId: sub.id, subjectName: sub.name, topicId: null, topicName: '' })
                            loadTopicsForSubject(sub.id)
                          }
                        }}
                        style={{
                          padding: '7px 14px', borderRadius: '20px',
                          border: `2px solid ${newTask.subjectId === sub.id ? '#3b82f6' : 'transparent'}`,
                          cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                          fontSize: '12px', fontWeight: '700',
                          background: newTask.subjectId === sub.id ? '#dbeafe' : '#f1f5f9',
                          color: newTask.subjectId === sub.id ? '#1e40af' : '#94a3b8',
                        }}
                      >{sub.name}</button>
                    ))}
                  </div>
                )}

                {newTask.subjectId && topicsList.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic (optional)</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {topicsList.map(topic => (
                        <button key={topic.id}
                          onClick={() => setNewTask({
                            ...newTask,
                            topicId: newTask.topicId === topic.id ? null : topic.id,
                            topicName: newTask.topicId === topic.id ? '' : topic.name,
                          })}
                          style={{
                            padding: '7px 14px', borderRadius: '20px',
                            border: `2px solid ${newTask.topicId === topic.id ? '#8b5cf6' : 'transparent'}`,
                            cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                            fontSize: '12px', fontWeight: '700',
                            background: newTask.topicId === topic.id ? '#ede9fe' : '#f1f5f9',
                            color: newTask.topicId === topic.id ? '#5b21b6' : '#94a3b8',
                          }}
                        >{topic.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Cancel</button>
              <button onClick={handleAddTask} style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={() => setShowAddTask(true)} style={{ position: 'fixed', bottom: '84px', right: 'calc(50% - 199px)', width: '54px', height: '54px', borderRadius: '50%', background: '#0f172a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(15,23,42,0.35)', zIndex: 100 }}>
        <Plus size={24} color="#38bdf8" />
      </button>
    </div>
  )
}
