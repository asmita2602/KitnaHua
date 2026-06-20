import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_CSS = {
  'Normal Day':        { bg: 'oklch(85% .13 95 / .15)',  text: 'var(--day-normal)',   border: 'var(--day-normal)' },
  'High Pressure Day': { bg: 'oklch(78% .16 50 / .15)',  text: 'var(--day-pressure)', border: 'var(--day-pressure)' },
  'Travel Day':        { bg: 'oklch(74% .15 310 / .15)', text: 'var(--day-travel)',   border: 'var(--day-travel)' },
  'Weekend Day':       { bg: 'oklch(82% .14 155 / .15)', text: 'var(--day-weekend)',  border: 'var(--day-weekend)' },
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay() }

function getDefaultDayType(dateStr) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6 ? 'Weekend Day' : 'Normal Day'
}

export default function CalendarScreen({ onSave }) {
  const today = localDateString()
  const todayDate = new Date()
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth())
  const [dayTypes, setDayTypes] = useState({})
  const [taskStats, setTaskStats] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => { loadMonthData() }, [currentMonth, currentYear])

  async function loadMonthData() {
    const allDays = await db.days.toArray()
    const dayMap = {}
    allDays.forEach(d => { dayMap[d.date] = d.dayType })
    setDayTypes(dayMap)

    const allTasks = await db.tasks.toArray()
    const templateTasks = allTasks.filter(t => t.date === 'template')
    const statsMap = {}

    allTasks.filter(t => t.date !== 'template').forEach(t => {
      if (!statsMap[t.date]) statsMap[t.date] = { total: 0, completed: 0, points: 0 }
      if (t.fromTemplateId != null) {
        if (t.completed) { statsMap[t.date].completed++; statsMap[t.date].points += (t.points || 0) }
      } else {
        statsMap[t.date].total++
        if (t.completed) { statsMap[t.date].completed++; statsMap[t.date].points += (t.points || 0) }
      }
    })

    const dayTypeMap = {}
    allDays.forEach(d => { dayTypeMap[d.date] = d.dayType })

    Object.keys(statsMap).forEach(dateStr => {
      const dt = dayTypeMap[dateStr] || (() => {
        const parts = dateStr.split('-').map(Number)
        const dow = new Date(parts[0], parts[1]-1, parts[2]).getDay()
        return dow === 0 || dow === 6 ? 'Weekend Day' : 'Normal Day'
      })()
      const templateCount = templateTasks.filter(t => t.dayTypeTemplate === dt).length
      statsMap[dateStr].total += templateCount
    })

    setTaskStats(statsMap)
  }

  function getDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  async function handleDayTypeChange(type) {
    await db.days.put({ date: selectedDate, dayType: type })
    setDayTypes(prev => ({ ...prev, [selectedDate]: type }))
    setShowPopup(false)
    onSave?.('days', { date: selectedDate, dayType: type })
  }

  function handleDateClick(dateStr) {
    setSelectedDate(dateStr)
    setShowPopup(true)
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div style={{ padding: '16px', fontFamily: 'Inter, sans-serif', paddingBottom: '32px' }}>

      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={prevMonth} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color='var(--fg)' />
        </button>
        <p style={{ fontSize: '17px', fontWeight: '800', color: 'var(--fg)' }}>{monthName}</p>
        <button onClick={nextMonth} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={20} color='var(--fg)' />
        </button>
      </div>

      {/* Weekday Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '6px', gap: '3px' }}>
        {weekDays.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = getDateStr(currentYear, currentMonth, day)
          const dayType = dayTypes[dateStr] || getDefaultDayType(dateStr)
          const css = DAY_TYPE_CSS[dayType]
          const stats = taskStats[dateStr]
          const isToday = dateStr === today

          return (
            <div key={dateStr} onClick={() => handleDateClick(dateStr)} style={{
              background: css.bg,
              border: isToday ? `2px solid var(--primary)` : `1px solid ${css.border}`,
              borderRadius: '10px', padding: '6px 4px', cursor: 'pointer',
              minHeight: '62px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '2px',
            }}>
              <p style={{ fontSize: '13px', fontWeight: isToday ? '800' : '700', color: isToday ? 'var(--primary)' : css.text }}>
                {day}
              </p>
              {stats && (
                <>
                  <p style={{ fontSize: '9px', fontWeight: '700', color: css.text, textAlign: 'center' }}>{stats.points} 🏆</p>
                  <p style={{ fontSize: '9px', color: css.text, textAlign: 'center' }}>✓ {stats.completed}/{stats.total}</p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '20px', background: 'var(--surface)', borderRadius: '14px', padding: '14px 16px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--fg)', marginBottom: '10px' }}>Day Types</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {DAY_TYPES.map(type => {
            const c = DAY_TYPE_CSS[type]
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: c.bg, border: `1px solid ${c.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)' }}>{type}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Popup */}
      {showPopup && selectedDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '340px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--fg)' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button onClick={() => setShowPopup(false)} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color='var(--muted-fg)' />
              </button>
            </div>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)', marginBottom: '10px' }}>Change day type:</p>
            {DAY_TYPES.map(type => {
              const c = DAY_TYPE_CSS[type]
              const current = dayTypes[selectedDate] || getDefaultDayType(selectedDate)
              const isSelected = current === type
              return (
                <button key={type} onClick={() => handleDayTypeChange(type)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '12px', marginBottom: '8px',
                  background: isSelected ? c.bg : 'var(--surface-2)',
                  border: isSelected ? `2px solid ${c.border}` : '1px solid var(--border)',
                  borderRadius: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: c.bg, border: `2px solid ${c.border}` }} />
                  <span style={{ fontSize: '14px', fontWeight: isSelected ? '700' : '500', color: isSelected ? c.text : 'var(--muted-fg)' }}>
                    {type}
                  </span>
                  {isSelected && <span style={{ marginLeft: 'auto', color: c.text, fontSize: '16px' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}