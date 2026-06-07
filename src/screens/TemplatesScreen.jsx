import { useState, useEffect } from 'react'
import { Plus, Clock, Trash2, X } from 'lucide-react'
import { db } from '../db'

const DAY_TYPES = ['Normal Day', 'High Pressure Day', 'Travel Day', 'Weekend Day']

const DAY_TYPE_COLORS = {
  'Normal Day': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  'High Pressure Day': { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  'Travel Day': { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  'Weekend Day': { bg: '#dcfce7', text: '#14532d', border: '#4ade80' },
}

const TAG_COLORS = {
  Study: { bg: '#dbeafe', text: '#1e40af' },
  Office: { bg: '#e0e7ff', text: '#3730a3' },
  Exercise: { bg: '#dcfce7', text: '#14532d' },
  Personal: { bg: '#fce7f3', text: '#9d174d' },
  Other: { bg: '#f1f5f9', text: '#475569' },
}

const PRIORITY_COLORS = {
  High: '#ef4444', Medium: '#f97316', Low: '#22c55e',
}

function formatDuration(start, end) {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return null
  return mins < 60 ? `${mins} min` : `${Math.round((mins / 60) * 10) / 10} h`
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
    allBlocks.forEach(b => {
      if (grouped[b.dayTypeTemplate]) grouped[b.dayTypeTemplate].push(b)
    })
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
    ...newBlock,
    points: Number(newBlock.points),
    date: 'template',
    dayTypeTemplate: activeTab,
    completed: false,
    feedbackDone: false,
  }
  const id = await db.tasks.add(blockData)  // id capture karo
  setNewBlock({ title: '', description: '', startTime: '', endTime: '', tag: 'Study', priority: 'Medium', points: 20, subjectId: null, subjectName: '', topicId: null, topicName: '' })
  setTopicsList([])
  setShowAddBlock(false)
  loadTemplates()
  onSave?.('tasks', { ...blockData, id })  // ADD THIS
}

  async function handleDeleteBlock(id) {
  await db.tasks.delete(id)
  loadTemplates()
  onSave?.('_delete_tasks', { id })  // ADD THIS
}

  const colors = DAY_TYPE_COLORS[activeTab]
  const currentBlocks = templates[activeTab] || []

  return (
    <div style={{ padding: '16px', paddingBottom: '100px', fontFamily: 'Nunito, sans-serif' }}>

      <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>
        Schedule Templates
      </p>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
        {DAY_TYPES.map(type => {
          const c = DAY_TYPE_COLORS[type]
          const isActive = activeTab === type
          return (
            <button key={type} onClick={() => setActiveTab(type)} style={{
              padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700',
              whiteSpace: 'nowrap', background: isActive ? c.bg : '#f1f5f9',
              color: isActive ? c.text : '#94a3b8',
              border: isActive ? `2px solid ${c.border}` : '2px solid transparent',
            }}>{type}</button>
          )
        })}
      </div>

      {/* Header */}
      <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
        <p style={{ fontSize: '15px', fontWeight: '800', color: colors.text }}>{activeTab}</p>
        <p style={{ fontSize: '12px', color: colors.text, marginTop: '2px', opacity: 0.8 }}>
          {currentBlocks.length} task blocks defined
        </p>
      </div>

      {/* Blocks */}
      {currentBlocks.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: '600' }}>No blocks yet. Tap + to add.</p>
        </div>
      ) : currentBlocks.map(block => {
        const duration = formatDuration(block.startTime, block.endTime)
        return (
          <div key={block.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, gap: '2px', minWidth: '36px' }}>
              <Clock size={18} color='#94a3b8' />
              {duration && <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>{duration}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>{block.title}</p>
              {block.subjectName && (
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', marginBottom: '3px' }}>
                  📚 {block.subjectName}{block.topicName ? ` → ${block.topicName}` : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: TAG_COLORS[block.tag]?.text }}>{block.tag}</span>
                <span style={{ color: '#cbd5e1', fontSize: '10px' }}>●</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: PRIORITY_COLORS[block.priority] }}>{block.priority}</span>
                <span style={{ color: '#cbd5e1', fontSize: '10px' }}>●</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>{block.points} 🏆</span>
              </div>
            </div>
            <button onClick={() => handleDeleteBlock(block.id)} style={{ background: '#fff5f5', border: 'none', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={16} color='#ef4444' />
            </button>
          </div>
        )
      })}

      {/* Add Block Modal */}
      {showAddBlock && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddBlock(false) }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '414px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Add Block — {activeTab}</p>
              <button onClick={() => setShowAddBlock(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color='#64748b' />
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
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>{field.label}</p>
                <input type={field.type} placeholder={field.placeholder} value={newBlock[field.key]}
                  onChange={e => setNewBlock({ ...newBlock, [field.key]: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
            ))}

            {/* Priority */}
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Priority</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['High', 'Medium', 'Low'].map(p => (
                <button key={p} onClick={() => setNewBlock({ ...newBlock, priority: p })} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${newBlock.priority === p ? PRIORITY_COLORS[p] : '#e2e8f0'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: '700', background: newBlock.priority === p ? PRIORITY_COLORS[p] : '#fff', color: newBlock.priority === p ? '#fff' : '#94a3b8' }}>{p}</button>
              ))}
            </div>

            {/* Tag */}
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Tag</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {['Study', 'Office', 'Exercise', 'Personal', 'Other'].map(tag => (
                <button key={tag} onClick={() => {
                  setNewBlock({ ...newBlock, tag, subjectId: null, subjectName: '', topicId: null, topicName: '' })
                  setTopicsList([])
                }} style={{ padding: '6px 14px', borderRadius: '20px', border: `2px solid ${newBlock.tag === tag ? TAG_COLORS[tag].text : 'transparent'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700', background: newBlock.tag === tag ? TAG_COLORS[tag].bg : '#f1f5f9', color: newBlock.tag === tag ? TAG_COLORS[tag].text : '#94a3b8' }}>{tag}</button>
              ))}
            </div>

            {/* Subject/Topic — only for Study tag */}
            {newBlock.tag === 'Study' && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Subject (optional)</p>
                {subjectsList.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>No subjects yet — add from Subjects screen first.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {subjectsList.map(sub => (
                      <button key={sub.id} onClick={() => {
                        if (newBlock.subjectId === sub.id) {
                          setNewBlock({ ...newBlock, subjectId: null, subjectName: '', topicId: null, topicName: '' })
                          setTopicsList([])
                        } else {
                          setNewBlock({ ...newBlock, subjectId: sub.id, subjectName: sub.name, topicId: null, topicName: '' })
                          loadTopicsForSubject(sub.id)
                        }
                      }} style={{ padding: '6px 14px', borderRadius: '20px', border: `2px solid ${newBlock.subjectId === sub.id ? '#3b82f6' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700', background: newBlock.subjectId === sub.id ? '#dbeafe' : '#f1f5f9', color: newBlock.subjectId === sub.id ? '#1e40af' : '#94a3b8' }}>{sub.name}</button>
                    ))}
                  </div>
                )}

                {newBlock.subjectId && topicsList.length > 0 && (
                  <>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Topic (optional)</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {topicsList.map(topic => (
                        <button key={topic.id} onClick={() => setNewBlock({ ...newBlock, topicId: newBlock.topicId === topic.id ? null : topic.id, topicName: newBlock.topicId === topic.id ? '' : topic.name })} style={{ padding: '6px 14px', borderRadius: '20px', border: `2px solid ${newBlock.topicId === topic.id ? '#8b5cf6' : 'transparent'}`, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700', background: newBlock.topicId === topic.id ? '#ede9fe' : '#f1f5f9', color: newBlock.topicId === topic.id ? '#5b21b6' : '#94a3b8' }}>{topic.name}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddBlock(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Cancel</button>
              <button onClick={handleAddBlock} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Add Block</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB — fixed position */}
      <button onClick={() => setShowAddBlock(true)} style={{ position: 'fixed', bottom: '80px', right: 'calc(50% - 191px)', width: '52px', height: '52px', borderRadius: '50%', background: '#0f172a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.3)', zIndex: 100 }}>
        <Plus size={24} color='#38bdf8' />
      </button>
    </div>
  )
}