import { useState, useEffect } from 'react'
import { Plus, Clock, Trash2, X } from 'lucide-react'
import { db } from '../db'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_CSS = {
  'Normal Day':        { text: 'var(--day-normal)',    border: 'var(--day-normal)',    bg: 'oklch(85% .13 95 / .12)' },
  'High Pressure Day': { text: 'var(--day-pressure)',  border: 'var(--day-pressure)',  bg: 'oklch(78% .16 50 / .12)' },
  'Travel Day':        { text: 'var(--day-travel)',    border: 'var(--day-travel)',    bg: 'oklch(74% .15 310 / .12)' },
  'Weekend Day':       { text: 'var(--day-weekend)',   border: 'var(--day-weekend)',   bg: 'oklch(82% .14 155 / .12)' },
}

const TAG_CHIP = {
  Study:    { bg: 'oklch(65% .18 240 / .15)', text: 'oklch(75% .15 240)' },
  Office:   { bg: 'oklch(65% .15 280 / .15)', text: 'oklch(75% .12 280)' },
  Exercise: { bg: 'oklch(65% .16 155 / .15)', text: 'oklch(75% .14 155)' },
  Personal: { bg: 'oklch(65% .18 320 / .15)', text: 'oklch(75% .15 320)' },
  Other:    { bg: 'oklch(50% .01 270 / .2)',  text: 'var(--muted-fg)' },
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

// Expected hours per day type per tag
const EXPECTED_HOURS = {
  'Normal Day':        { Study: 4, Office: 8, Exercise: 0.75 },
  'High Pressure Day': { Study: 2, Office: 10, Exercise: 0.5 },
  'Travel Day':        { Study: 1, Office: 4, Exercise: 0 },
  'Weekend Day':       { Study: 5, Office: 0, Exercise: 1 },
}

function formatDuration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins < 60 ? `${mins}m` : `${Math.round((mins / 60) * 10) / 10}h`
}

export default function TemplatesScreen({ onSave }) {
  const [activeTab, setActiveTab] = useState('Normal Day')
  const [templates, setTemplates] = useState({})
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [subjectsList, setSubjectsList] = useState([])
  const [topicsList, setTopicsList] = useState([])
  const [newBlock, setNewBlock] = useState({
    title: '', description: '', startTime: '', endTime: '',
    tag: 'Study', priority: 'Medium', points: 20,
    subjectId: null, subjectName: '', topicId: null, topicName: '',
  })

  useEffect(() => { loadTemplates(); loadSubjects() }, [])

  async function loadTemplates() {
    const allBlocks = await db.tasks.where('date').equals('template').toArray()
    const grouped = {}
    DAY_TYPES.forEach(t => { grouped[t] = [] })
    allBlocks.forEach(b => { if (grouped[b.dayTypeTemplate]) grouped[b.dayTypeTemplate].push(b) })
    setTemplates(grouped)
  }

  async function loadSubjects() {
    const subs = await db.subjects.toArray()
    setSubjectsList(subs)
  }

  async function loadTopicsForSubject(subjectId) {
    const topics = await db.topics.where('subjectId').equals(subjectId).toArray()
    setTopicsList(topics)
  }

  async function handleAddBlock() {
    if (!newBlock.title.trim()) return
    const blockData = {
      ...newBlock, points: Number(newBlock.points), date: 'template',
      dayTypeTemplate: activeTab, completed: false, feedbackDone: false,
    }
    const id = await db.tasks.add(blockData)
    setNewBlock({ title: '', description: '', startTime: '', endTime: '', tag: 'Study', priority: 'Medium', points: 20, subjectId: null, subjectName: '', topicId: null, topicName: '' })
    setTopicsList([])
    setShowAddBlock(false)
    loadTemplates()
    onSave?.('tasks', { ...blockData, id })
  }

  async function handleDeleteBlock(id) {
    await db.tasks.delete(id)
    loadTemplates()
    onSave?.('_delete_tasks', { id })
  }

  const css = DAY_TYPE_CSS[activeTab]
  const currentBlocks = templates[activeTab] || []
  const expHours = EXPECTED_HOURS[activeTab] || {}

  // Compute actual hours from blocks
  function computedHours(tag) {
    const blocks = currentBlocks.filter(b => b.tag === tag)
    return blocks.reduce((sum, b) => {
      if (!b.startTime || !b.endTime) return sum
      const [sh, sm] = b.startTime.split(':').map(Number)
      const [eh, em] = b.endTime.split(':').map(Number)
      let mins = (eh * 60 + em) - (sh * 60 + sm)
      if (mins <= 0) mins += 24 * 60
      return sum + mins / 60
    }, 0)
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '100px', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ── */}
      <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--primary)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
        MASTER SCHEDULES
      </p>
      <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--fg)', marginBottom: '4px' }}>
        Plan your day-types
      </p>
      <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted-fg)', marginBottom: '20px' }}>
        Define what an ideal day looks like for each mode.
      </p>

      {/* ── Tab Selector ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {DAY_TYPES.map(type => {
          const c = DAY_TYPE_CSS[type]
          const isActive = activeTab === type
          return (
            <button key={type} onClick={() => setActiveTab(type)} style={{
              padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700',
              whiteSpace: 'nowrap',
              background: isActive ? c.bg : 'var(--surface)',
              color: isActive ? c.text : 'var(--muted-fg)',
              border: isActive ? `1.5px solid ${c.border}` : '1.5px solid transparent',
            }}>{type}</button>
          )
        })}
      </div>

      {/* ── Expected Hours ── */}
      <div style={{ background: 'var(--surface-2)', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--primary)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '12px' }}>
          EXPECTED HOURS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {['Study', 'Office', 'Exercise'].map(tag => {
            const actual = computedHours(tag)
            const expected = expHours[tag] || 0
            return (
              <div key={tag} style={{ background: 'var(--surface)', borderRadius: '12px', padding: '12px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '9px', fontWeight: '700', color: 'var(--muted-fg)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>{tag}</p>
                <p style={{ fontSize: '22px', fontWeight: '900', color: actual > 0 ? 'var(--primary)' : 'var(--fg)' }}>
                  {actual > 0 ? actual.toFixed(1) : expected}
                </p>
                <p style={{ fontSize: '9px', fontWeight: '500', color: 'var(--muted-fg)', marginTop: '2px' }}>hrs</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Task Blocks ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--fg)' }}>Task blocks</p>
        <button onClick={() => setShowAddBlock(true)} style={{
          background: 'var(--gradient-hero)', border: 'none', borderRadius: '20px',
          padding: '7px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
          fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: '700',
          color: 'oklch(16% .02 270)',
        }}>
          <Plus size={15} color='oklch(16% .02 270)' /> Add
        </button>
      </div>

      {currentBlocks.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--muted-fg)', border: '1px solid var(--border)', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: '500' }}>No blocks yet. Tap Add.</p>
        </div>
      ) : currentBlocks.map(block => {
        const duration = formatDuration(block.startTime, block.endTime)
        const pColor = PRIORITY_BORDER[block.priority] || 'var(--border)'
        const tagC = TAG_CHIP[block.tag] || TAG_CHIP.Other
        const prioC = PRIORITY_CHIP[block.priority] || PRIORITY_CHIP.Medium
        return (
          <div key={block.id} style={{
            background: 'var(--gradient-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '13px 14px 13px 18px',
            marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: pColor, borderRadius: '14px 0 0 14px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: '2px', minWidth: '36px' }}>
              <Clock size={15} color='var(--muted-fg)' />
              {duration && <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--muted-fg)' }}>{duration}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--fg)', marginBottom: '5px' }}>{block.title}</p>
              {block.subjectName && (
                <p style={{ fontSize: '11px', fontWeight: '600', color: 'oklch(75% .15 240)', marginBottom: '4px' }}>
                  📚 {block.subjectName}{block.topicName ? ` → ${block.topicName}` : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: tagC.text, background: tagC.bg, borderRadius: '20px', padding: '2px 8px' }}>{block.tag}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: prioC.text, background: prioC.bg, borderRadius: '20px', padding: '2px 8px' }}>{block.priority}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', background: 'oklch(83% .17 75 / .15)', borderRadius: '20px', padding: '2px 8px' }}>+{block.points} pts</span>
              </div>
            </div>
            <button onClick={() => handleDeleteBlock(block.id)} style={{ background: 'oklch(68% .22 22 / .15)', border: 'none', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={15} color='var(--priority-high)' />
            </button>
          </div>
        )
      })}

      {/* ── Add Block Modal ── */}
      {showAddBlock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddBlock(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '414px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '17px', fontWeight: '800', color: 'var(--fg)' }}>Add Block — {activeTab}</p>
              <button onClick={() => setShowAddBlock(false)} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color='var(--muted-fg)' />
              </button>
            </div>

            {[
              { label: 'Title *', key: 'title', type: 'text', placeholder: 'e.g. DSA Practice' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Optional' },
              { label: 'Start Time', key: 'startTime', type: 'time' },
              { label: 'End Time', key: 'endTime', type: 'time' },
              { label: 'Points', key: 'points', type: 'number', placeholder: '20' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{field.label}</p>
                <input type={field.type} placeholder={field.placeholder} value={newBlock[field.key]}
                  onChange={e => setNewBlock({ ...newBlock, [field.key]: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', boxSizing: 'border-box', background: 'var(--surface-2)', colorScheme: 'dark' }} />
              </div>
            ))}

            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setNewBlock({ ...newBlock, priority: p })} style={{
                  flex: 1, padding: '8px', borderRadius: '8px',
                  border: `2px solid ${newBlock.priority === p ? PRIORITY_BORDER[p] : 'var(--border)'}`,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: '700',
                  background: newBlock.priority === p ? PRIORITY_CHIP[p].bg : 'transparent',
                  color: newBlock.priority === p ? PRIORITY_CHIP[p].text : 'var(--muted-fg)',
                }}>{p}</button>
              ))}
            </div>

            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tag</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {['Study', 'Office', 'Exercise', 'Personal', 'Other'].map(tag => (
                <button key={tag} onClick={() => { setNewBlock({ ...newBlock, tag, subjectId: null, subjectName: '', topicId: null, topicName: '' }); setTopicsList([]) }} style={{
                  padding: '6px 14px', borderRadius: '20px',
                  border: `2px solid ${newBlock.tag === tag ? TAG_CHIP[tag].text : 'transparent'}`,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700',
                  background: newBlock.tag === tag ? TAG_CHIP[tag].bg : 'var(--surface-2)',
                  color: newBlock.tag === tag ? TAG_CHIP[tag].text : 'var(--muted-fg)',
                }}>{tag}</button>
              ))}
            </div>

            {newBlock.tag === 'Study' && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject (optional)</p>
                {subjectsList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>No subjects yet.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {subjectsList.map(sub => (
                      <button key={sub.id} onClick={() => {
                        if (newBlock.subjectId === sub.id) { setNewBlock({ ...newBlock, subjectId: null, subjectName: '', topicId: null, topicName: '' }); setTopicsList([]) }
                        else { setNewBlock({ ...newBlock, subjectId: sub.id, subjectName: sub.name, topicId: null, topicName: '' }); loadTopicsForSubject(sub.id) }
                      }} style={{ padding: '6px 14px', borderRadius: '20px', border: `2px solid ${newBlock.subjectId === sub.id ? 'oklch(75% .15 240)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700', background: newBlock.subjectId === sub.id ? 'oklch(65% .18 240 / .2)' : 'var(--surface-2)', color: newBlock.subjectId === sub.id ? 'oklch(75% .15 240)' : 'var(--muted-fg)' }}>{sub.name}</button>
                    ))}
                  </div>
                )}
                {newBlock.subjectId && topicsList.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic (optional)</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {topicsList.map(topic => (
                        <button key={topic.id} onClick={() => setNewBlock({ ...newBlock, topicId: newBlock.topicId === topic.id ? null : topic.id, topicName: newBlock.topicId === topic.id ? '' : topic.name })} style={{ padding: '6px 14px', borderRadius: '20px', border: `2px solid ${newBlock.topicId === topic.id ? 'oklch(75% .12 280)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '700', background: newBlock.topicId === topic.id ? 'oklch(65% .15 280 / .2)' : 'var(--surface-2)', color: newBlock.topicId === topic.id ? 'oklch(75% .12 280)' : 'var(--muted-fg)' }}>{topic.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowAddBlock(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-fg)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAddBlock} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Add Block</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}