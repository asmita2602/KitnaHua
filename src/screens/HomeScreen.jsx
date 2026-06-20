import { useState, useEffect, useRef } from 'react'
import { Plus, Clock, Trash2 } from 'lucide-react'
import { db } from '../db'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_COLORS = {
  'Normal Day':        { bg: 'oklch(85% .13 95 / .12)', text: 'var(--day-normal)', border: 'var(--day-normal)' },
  'High Pressure Day': { bg: 'oklch(78% .16 50 / .12)', text: 'var(--day-pressure)', border: 'var(--day-pressure)' },
  'Travel Day':        { bg: 'oklch(74% .15 310 / .12)', text: 'var(--day-travel)', border: 'var(--day-travel)' },
  'Weekend Day':       { bg: 'oklch(82% .14 155 / .12)', text: 'var(--day-weekend)', border: 'var(--day-weekend)' },
}

const PRIORITY_BORDER = {
  High: 'var(--priority-high)',
  Medium: 'var(--priority-medium)',
  Low: 'var(--priority-low)',
}

const PRIORITY_CHIP = {
  High:   { bg: 'oklch(68% .22 22 / .2)',  text: 'var(--priority-high)' },
  Medium: { bg: 'oklch(78% .17 55 / .2)',  text: 'var(--priority-medium)' },
  Low:    { bg: 'oklch(78% .16 155 / .2)', text: 'var(--priority-low)' },
}

const TAG_CHIP = {
  Study:    { bg: 'oklch(65% .18 240 / .15)', text: 'oklch(75% .15 240)' },
  Office:   { bg: 'oklch(65% .15 280 / .15)', text: 'oklch(75% .12 280)' },
  Exercise: { bg: 'oklch(65% .16 155 / .15)', text: 'oklch(75% .14 155)' },
  Personal: { bg: 'oklch(65% .18 320 / .15)', text: 'oklch(75% .15 320)' },
  Other:    { bg: 'oklch(50% .01 270 / .2)',  text: 'var(--muted-fg)' },
}

// Legacy for add modal selectors only
const PRIORITY_COLORS = { High: 'var(--priority-high)', Medium: 'var(--priority-medium)', Low: 'var(--priority-low)' }
const TAG_COLORS = {
  Study:    { bg: 'oklch(65% .18 240 / .15)', text: 'oklch(75% .15 240)' },
  Office:   { bg: 'oklch(65% .15 280 / .15)', text: 'oklch(75% .12 280)' },
  Exercise: { bg: 'oklch(65% .16 155 / .15)', text: 'oklch(75% .14 155)' },
  Personal: { bg: 'oklch(65% .18 320 / .15)', text: 'oklch(75% .15 320)' },
  Other:    { bg: 'oklch(50% .01 270 / .2)',  text: 'var(--muted-fg)' },
}

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function addDaysToStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}
function getDefaultDayType(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6 ? 'Weekend Day' : 'Normal Day'
}
function formatDuration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins < 60 ? `${mins}m` : `${Math.round((mins / 60) * 10) / 10}h`
}

export default function HomeScreen({ onPointsUpdate }) {
  const todayStr = localDateString()
  const [currentDate, setCurrentDate] = useState(todayStr)
  const [dayType, setDayType] = useState(getDefaultDayType(todayStr))
  const [showDropdown, setShowDropdown] = useState(false)
  const [templateTasks, setTemplateTasks] = useState([])
  const [extraTasks, setExtraTasks] = useState([])
  const [completedTemplateIds, setCompletedTemplateIds] = useState(new Set())
  const [showAddTask, setShowAddTask] = useState(false)
  const [subjectsList, setSubjectsList] = useState([])
  const [topicsList, setTopicsList] = useState([])
  const [newTask, setNewTask] = useState({
    title: '', description: '', startTime: '', endTime: '',
    priority: 'Medium', points: 20, tag: 'Study',
    subjectId: null, subjectName: '', topicId: null, topicName: '',
  })
  const swipeRef = useRef({ startX: 0, startY: 0, active: false })

  useEffect(() => { loadDayData() }, [currentDate])
  useEffect(() => { loadSubjects() }, [])

  async function loadDayData() {
    const dayRecord = await db.days.get(currentDate)
    const dt = dayRecord?.dayType || getDefaultDayType(currentDate)
    setDayType(dt)

    async function cleanupOrphanCompletions() {
      try {
        const templates = await db.tasks.where('date').equals('template').toArray()
        const templateIds = new Set(templates.map(t => t.id))
        const allSaved = await db.tasks.toArray()
        for (const task of allSaved) {
          if (task.fromTemplateId != null && !templateIds.has(task.fromTemplateId)) {
            await db.tasks.delete(task.id)
          }
        }
      } catch {}
    }
    await cleanupOrphanCompletions()

    const allTemplates = await db.tasks.where('date').equals('template').toArray()
    const todayTemplates = allTemplates.filter(t => t.dayTypeTemplate === dt)
    setTemplateTasks(todayTemplates)

    const savedTasks = await db.tasks.where('date').equals(currentDate).toArray()
    const doneTemplateIds = new Set(
      savedTasks
        .filter(t => t.fromTemplateId !== null && t.fromTemplateId !== undefined && t.completed)
        .map(t => t.fromTemplateId)
    )
    setCompletedTemplateIds(doneTemplateIds)

    const extra = savedTasks.filter(t => t.fromTemplateId === null || t.fromTemplateId === undefined)
    setExtraTasks(extra)
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
    loadDayData()
  }

  async function handleToggleTemplate(templateTask) {
    const isCompleted = completedTemplateIds.has(templateTask.id)
    if (isCompleted) {
      const savedTasks = await db.tasks.where('date').equals(currentDate).toArray()
      const saved = savedTasks.find(t => t.fromTemplateId === templateTask.id)
      if (saved) await db.tasks.delete(saved.id)
    } else {
      await db.tasks.add({
        ...templateTask, id: undefined, date: currentDate,
        fromTemplateId: templateTask.id, completed: true, feedbackDone: false,
      })
    }
    loadDayData()
    onPointsUpdate?.()
  }

  async function handleToggleExtra(task) {
    await db.tasks.update(task.id, { completed: !task.completed })
    loadDayData()
    onPointsUpdate?.()
  }

  async function handleDeleteExtra(task) {
    await db.tasks.delete(task.id)
    loadDayData()
    onPointsUpdate?.()
  }

  async function handleAddTask() {
    if (!newTask.title.trim()) return
    await db.tasks.add({
      ...newTask, points: Number(newTask.points), date: currentDate,
      completed: false, feedbackDone: false, fromTemplateId: null,
    })
    setNewTask({
      title: '', description: '', startTime: '', endTime: '',
      priority: 'Medium', points: 20, tag: 'Study',
      subjectId: null, subjectName: '', topicId: null, topicName: '',
    })
    setShowAddTask(false)
    loadDayData()
    onPointsUpdate?.()
  }

  function goToPrev() { setCurrentDate(d => addDaysToStr(d, -1)) }
  function goToNext() { setCurrentDate(d => addDaysToStr(d, 1)) }
  function onTouchStart(e) {
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, active: true }
  }
  function onTouchEnd(e) {
    if (!swipeRef.current.active) return
    const dx = swipeRef.current.startX - e.changedTouches[0].clientX
    const dy = Math.abs(swipeRef.current.startY - e.changedTouches[0].clientY)
    swipeRef.current.active = false
    if (dy > 40) return
    if (dx > 50) goToNext()
    else if (dx < -50) goToPrev()
  }

  const totalTasks = templateTasks.length + extraTasks.length
  const completedTasks = completedTemplateIds.size + extraTasks.filter(t => t.completed).length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const colors = DAY_TYPE_COLORS[dayType]
  const circumference = 2 * Math.PI * 36
  const strokeDash = (progress / 100) * circumference
  const isToday = currentDate === todayStr

  // Points total
  const totalPoints = completedTemplateIds.size > 0 || extraTasks.filter(t => t.completed).length > 0
    ? [...Array.from(completedTemplateIds)].reduce((sum, id) => {
        const t = templateTasks.find(t => t.id === id)
        return sum + (t?.points || 0)
      }, 0) + extraTasks.filter(t => t.completed).reduce((sum, t) => sum + (t.points || 0), 0)
    : 0

  return (
    <div
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ padding: '16px', paddingBottom: '90px', fontFamily: 'Inter, sans-serif', userSelect: 'none' }}
    >

      {/* ── Header ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-fg)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>
              {isToday ? 'TODAY' : 'VIEWING'}
            </p>
            <p style={{ fontSize: '28px', fontWeight: '900', color: 'var(--fg)', lineHeight: 1.1 }}>
              {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}
            </p>
            <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted-fg)', marginTop: '2px' }}>
              {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {!isToday && (
              <button onClick={() => setCurrentDate(todayStr)} style={{ marginTop: '6px', fontSize: '11px', fontWeight: '600', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>
                Back to Today
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <button onClick={goToPrev} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--surface)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>‹</button>
            <button onClick={goToNext} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--surface)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-fg)' }}>›</button>
          </div>
        </div>

        {/* Day type pill */}
        <div style={{ position: 'relative', display: 'inline-block', marginTop: '12px' }}>
          <button onClick={() => setShowDropdown(!showDropdown)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: colors.bg, border: `1.5px solid ${colors.border}`,
            borderRadius: '12px', padding: '8px 14px', cursor: 'pointer',
            fontWeight: '700', fontSize: '14px', color: colors.text,
            fontFamily: 'Inter, sans-serif',
          }}>
            {dayType} <span style={{ fontSize: '11px' }}>▾</span>
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: 'var(--surface)', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: '190px', border: '1px solid var(--border)' }}>
              {DAY_TYPES.map(type => {
                const c = DAY_TYPE_COLORS[type]
                return (
                  <button key={type} onClick={() => handleDayTypeChange(type)} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px',
                    border: 'none', cursor: 'pointer', background: type === dayType ? c.bg : 'transparent',
                    color: c.text, fontWeight: type === dayType ? '700' : '500',
                    fontSize: '14px', fontFamily: 'Inter, sans-serif',
                  }}>
                    {type}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress + Stats ── */}
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle cx="44" cy="44" r="36" fill="none" stroke="var(--primary)" strokeWidth="8"
              strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 44 44)" />
            <text x="44" y="44" textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: '16px', fontWeight: '900', fill: 'var(--primary)', fontFamily: 'Inter' }}>
              {progress}%
            </text>
          </svg>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--fg)' }}>
              {isToday ? "Today's Progress" : "Day's Progress"}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '4px', fontWeight: '500' }}>
              {completedTasks} of {totalTasks} tasks done
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'TASKS', value: `${completedTasks}/${totalTasks}` },
            { label: 'POINTS', value: totalPoints, accent: true },
            { label: 'PROGRESS', value: `${progress}%`, accent: true },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '800', color: s.accent ? 'var(--primary)' : 'var(--fg)' }}>{s.value}</p>
              <p style={{ fontSize: '9px', fontWeight: '600', color: 'var(--muted-fg)', letterSpacing: '0.8px', marginTop: '2px' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Schedule Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ fontSize: '17px', fontWeight: '800', color: 'var(--fg)' }}>
          Today's Schedule
        </p>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)' }}>
          {totalTasks} blocks
        </span>
      </div>

      {totalTasks === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: '14px', padding: '28px', textAlign: 'center', color: 'var(--muted-fg)', border: '1px solid var(--border)', marginBottom: '12px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500' }}>No tasks yet. Tap + to add.</p>
        </div>
      )}

      {/* ── Template Tasks ── */}
      {templateTasks.map(task => {
        const isCompleted = completedTemplateIds.has(task.id)
        const dur = formatDuration(task.startTime, task.endTime)
        const pColor = PRIORITY_BORDER[task.priority] || 'var(--border)'
        const tagC = TAG_CHIP[task.tag] || TAG_CHIP.Other
        const prioC = PRIORITY_CHIP[task.priority] || PRIORITY_CHIP.Medium
        return (
          <div key={`tpl_${task.id}`} style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px', padding: '13px 14px 13px 18px',
            marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Left priority stripe */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pColor, borderRadius: '14px 0 0 14px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: '2px', minWidth: '34px' }}>
              <Clock size={15} color='var(--muted-fg)' />
              {dur && <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--muted-fg)' }}>{dur}</span>}
              {task.startTime && <span style={{ fontSize: '9px', color: 'var(--muted-fg)', fontWeight: '500' }}>{task.startTime}</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '15px', fontWeight: '700',
                color: isCompleted ? 'var(--muted-fg)' : 'var(--fg)',
                textDecoration: isCompleted ? 'line-through' : 'none',
                marginBottom: '5px', textTransform: 'capitalize',
              }}>{task.title}</p>
              {task.subjectName && (
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'oklch(75% .15 240)', marginBottom: '4px' }}>
                  📚 {task.subjectName}{task.topicName ? ` → ${task.topicName}` : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: tagC.text, background: tagC.bg, borderRadius: '20px', padding: '2px 8px' }}>{task.tag}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: prioC.text, background: prioC.bg, borderRadius: '20px', padding: '2px 8px' }}>{task.priority}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'oklch(83% .17 75 / .15)', borderRadius: '20px', padding: '2px 8px' }}>+{task.points} pts</span>
              </div>
            </div>

            <button onClick={() => handleToggleTemplate(task)} style={{
              width: '34px', height: '34px', borderRadius: '50%',
              border: `2px solid ${isCompleted ? 'var(--priority-low)' : 'var(--border)'}`,
              background: isCompleted ? 'var(--priority-low)' : 'transparent',
              color: isCompleted ? 'oklch(16% .02 270)' : 'var(--muted-fg)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '900', flexShrink: 0,
            }}>
              {isCompleted ? '✓' : ''}
            </button>
          </div>
        )
      })}

      {/* Divider */}
      {templateTasks.length > 0 && extraTasks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--muted-fg)' }}>Extra tasks</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>
      )}

      {/* ── Extra Tasks ── */}
      {extraTasks.map(task => {
        const dur = formatDuration(task.startTime, task.endTime)
        const pColor = PRIORITY_BORDER[task.priority] || 'var(--border)'
        const tagC = TAG_CHIP[task.tag] || TAG_CHIP.Other
        const prioC = PRIORITY_CHIP[task.priority] || PRIORITY_CHIP.Medium
        return (
          <div key={`extra_${task.id}`} style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px', padding: '13px 14px 13px 18px',
            marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pColor, borderRadius: '14px 0 0 14px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: '2px', minWidth: '34px' }}>
              <Clock size={15} color='var(--muted-fg)' />
              {dur && <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--muted-fg)' }}>{dur}</span>}
              {task.startTime && <span style={{ fontSize: '9px', color: 'var(--muted-fg)', fontWeight: '500' }}>{task.startTime}</span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '15px', fontWeight: '700',
                color: task.completed ? 'var(--muted-fg)' : 'var(--fg)',
                textDecoration: task.completed ? 'line-through' : 'none',
                marginBottom: '5px', textTransform: 'capitalize',
              }}>{task.title}</p>
              {task.subjectName && (
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'oklch(75% .15 240)', marginBottom: '4px' }}>
                  📚 {task.subjectName}{task.topicName ? ` → ${task.topicName}` : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: tagC.text, background: tagC.bg, borderRadius: '20px', padding: '2px 8px' }}>{task.tag}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: prioC.text, background: prioC.bg, borderRadius: '20px', padding: '2px 8px' }}>{task.priority}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'oklch(83% .17 75 / .15)', borderRadius: '20px', padding: '2px 8px' }}>+{task.points} pts</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
              <button onClick={() => handleToggleExtra(task)} style={{
                width: '34px', height: '34px', borderRadius: '50%',
                border: `2px solid ${task.completed ? 'var(--priority-low)' : 'var(--border)'}`,
                background: task.completed ? 'var(--priority-low)' : 'transparent',
                color: task.completed ? 'oklch(16% .02 270)' : 'var(--muted-fg)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '900',
              }}>
                {task.completed ? '✓' : ''}
              </button>
              <button onClick={() => handleDeleteExtra(task)} style={{
                width: '34px', height: '34px', borderRadius: '50%',
                border: 'none', background: 'oklch(68% .22 22 / .15)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={13} color='var(--priority-high)' />
              </button>
            </div>
          </div>
        )
      })}

      {/* ── Add Task Modal ── */}
      {showAddTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddTask(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '414px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '99px', margin: '0 auto 18px' }} />
            <p style={{ fontSize: '17px', fontWeight: '800', color: 'var(--fg)', marginBottom: '16px' }}>Add Task</p>

            {[
              { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. DSA Practice' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Optional' },
              { label: 'Start Time', key: 'startTime', type: 'time' },
              { label: 'End Time', key: 'endTime', type: 'time' },
              { label: 'Points', key: 'points', type: 'number', placeholder: '20' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field.label}</p>
                <input type={field.type} placeholder={field.placeholder} value={newTask[field.key]}
                  onChange={e => setNewTask({ ...newTask, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value })}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: '11px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', boxSizing: 'border-box', background: 'var(--surface-2)', colorScheme: 'dark' }} />
              </div>
            ))}

            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {['High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setNewTask({ ...newTask, priority: p })} style={{
                  flex: 1, padding: '9px', borderRadius: '10px',
                  border: `2px solid ${newTask.priority === p ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: '700',
                  background: newTask.priority === p ? PRIORITY_CHIP[p].bg : 'transparent',
                  color: newTask.priority === p ? PRIORITY_COLORS[p] : 'var(--muted-fg)',
                }}>{p}</button>
              ))}
            </div>

            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tag</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: newTask.tag === 'Study' ? '14px' : '22px' }}>
              {['Study', 'Office', 'Exercise', 'Personal', 'Other'].map(tag => (
                <button key={tag} onClick={() => { setNewTask({ ...newTask, tag, subjectId: null, subjectName: '', topicId: null, topicName: '' }); setTopicsList([]) }} style={{
                  padding: '7px 14px', borderRadius: '20px',
                  border: `2px solid ${newTask.tag === tag ? TAG_COLORS[tag].text : 'transparent'}`,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700',
                  background: newTask.tag === tag ? TAG_COLORS[tag].bg : 'var(--surface-2)',
                  color: newTask.tag === tag ? TAG_COLORS[tag].text : 'var(--muted-fg)',
                }}>{tag}</button>
              ))}
            </div>

            {newTask.tag === 'Study' && (
              <div style={{ marginBottom: '22px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject (optional)</p>
                {subjectsList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>No subjects — add from Subjects screen first.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {subjectsList.map(sub => (
                      <button key={sub.id} onClick={() => {
                        if (newTask.subjectId === sub.id) { setNewTask({ ...newTask, subjectId: null, subjectName: '', topicId: null, topicName: '' }); setTopicsList([]) }
                        else { setNewTask({ ...newTask, subjectId: sub.id, subjectName: sub.name, topicId: null, topicName: '' }); loadTopicsForSubject(sub.id) }
                      }} style={{ padding: '7px 14px', borderRadius: '20px', border: `2px solid ${newTask.subjectId === sub.id ? 'oklch(75% .15 240)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700', background: newTask.subjectId === sub.id ? 'oklch(65% .18 240 / .2)' : 'var(--surface-2)', color: newTask.subjectId === sub.id ? 'oklch(75% .15 240)' : 'var(--muted-fg)' }}>{sub.name}</button>
                    ))}
                  </div>
                )}
                {newTask.subjectId && topicsList.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic (optional)</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {topicsList.map(topic => (
                        <button key={topic.id} onClick={() => setNewTask({ ...newTask, topicId: newTask.topicId === topic.id ? null : topic.id, topicName: newTask.topicId === topic.id ? '' : topic.name })} style={{ padding: '7px 14px', borderRadius: '20px', border: `2px solid ${newTask.topicId === topic.id ? 'oklch(75% .12 280)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700', background: newTask.topicId === topic.id ? 'oklch(65% .15 280 / .2)' : 'var(--surface-2)', color: newTask.topicId === topic.id ? 'oklch(75% .12 280)' : 'var(--muted-fg)' }}>{topic.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-fg)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAddTask} style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={() => setShowAddTask(true)} style={{
        position: 'fixed', bottom: '84px', right: 'calc(50% - 191px)',
        width: '54px', height: '54px', borderRadius: '50%',
        background: 'var(--gradient-hero)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px oklch(83% .17 75 / .4)', zIndex: 100,
      }}>
        <Plus size={24} color="oklch(16% .02 270)" />
      </button>
    </div>
  )
}