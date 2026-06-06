import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { db } from '../db'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_COLORS = {
  'Normal Day': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'High Pressure Day': { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  'Travel Day': { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  'Weekend Day': { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

function getDefaultDayType(dateStr) {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6 ? 'Weekend Day' : 'Normal Day'
}

export default function CalendarScreen() {
  const today = getTodayString()
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
    const statsMap = {}
    allTasks.forEach(t => {
      if (!statsMap[t.date]) statsMap[t.date] = { total: 0, completed: 0, points: 0 }
      statsMap[t.date].total++
      if (t.completed) {
        statsMap[t.date].completed++
        statsMap[t.date].points += (t.points || 0)
      }
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
    <div style={{ padding: '16px', fontFamily: 'Nunito, sans-serif' }}>

      {/* Month Navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <button onClick={prevMonth} style={{
          background: '#f1f5f9', border: 'none', borderRadius: '10px',
          width: '36px', height: '36px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronLeft size={20} color='#0f172a' />
        </button>
        <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
          {monthName}
        </p>
        <button onClick={nextMonth} style={{
          background: '#f1f5f9', border: 'none', borderRadius: '10px',
          width: '36px', height: '36px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChevronRight size={20} color='#0f172a' />
        </button>
      </div>

      {/* Weekday Headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: '6px', gap: '3px',
      }}>
        {weekDays.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '11px',
            fontWeight: '700', color: '#94a3b8', padding: '4px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px',
      }}>
        {/* Empty cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = getDateStr(currentYear, currentMonth, day)
          const dayType = dayTypes[dateStr] || getDefaultDayType(dateStr)
          const colors = DAY_TYPE_COLORS[dayType]
          const stats = taskStats[dateStr]
          const isToday = dateStr === today

          return (
            <div
              key={dateStr}
              onClick={() => handleDateClick(dateStr)}
              style={{
                background: colors.bg,
                border: isToday ? `2px solid #38bdf8` : `1px solid ${colors.border}`,
                borderRadius: '10px',
                padding: '6px 4px',
                cursor: 'pointer',
                minHeight: '62px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <p style={{
                fontSize: '13px', fontWeight: isToday ? '800' : '700',
                color: isToday ? '#38bdf8' : colors.text,
              }}>
                {day}
              </p>
              {stats && (
                <>
                  <p style={{ fontSize: '9px', fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                    {stats.points} 🏆
                  </p>
                  <p style={{ fontSize: '9px', color: colors.text, textAlign: 'center' }}>
                    ✓ {stats.completed}/{stats.total}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '20px', background: '#fff', borderRadius: '14px',
        padding: '14px 16px', border: '1px solid #e2e8f0',
      }}>
        <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
          Day Types
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {DAY_TYPES.map(type => {
            const c = DAY_TYPE_COLORS[type]
            return (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{
                  width: '14px', height: '14px', borderRadius: '4px',
                  background: c.bg, border: `1px solid ${c.border}`, flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  {type}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Popup */}
      {showPopup && selectedDate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '20px', width: '100%', maxWidth: '340px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button onClick={() => setShowPopup(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: '8px',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} color='#64748b' />
              </button>
            </div>

            <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>
              Change day type:
            </p>

            {DAY_TYPES.map(type => {
              const c = DAY_TYPE_COLORS[type]
              const current = dayTypes[selectedDate] || getDefaultDayType(selectedDate)
              const isSelected = current === type
              return (
                <button key={type} onClick={() => handleDayTypeChange(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px', marginBottom: '8px',
                    background: isSelected ? c.bg : '#f8fafc',
                    border: isSelected ? `2px solid ${c.border}` : '1px solid #e2e8f0',
                    borderRadius: '12px', cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '4px',
                    background: c.bg, border: `2px solid ${c.border}`,
                  }} />
                  <span style={{
                    fontSize: '14px', fontWeight: isSelected ? '800' : '600',
                    color: isSelected ? c.text : '#475569',
                  }}>
                    {type}
                  </span>
                  {isSelected && (
                    <span style={{ marginLeft: 'auto', color: c.text, fontSize: '16px' }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}