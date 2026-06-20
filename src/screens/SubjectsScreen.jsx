import { useState, useEffect } from 'react'
import { Plus, X, ChevronRight, Layers, Video, Clock, ArrowLeft } from 'lucide-react'
import { db } from '../db'

function getLastStudiedText(dateStr) {
  if (!dateStr) return 'Not started'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function ProgressBar({ value, height = 8 }) {
  const color = value >= 80 ? 'oklch(65% .16 155)' : value >= 50 ? 'oklch(65% .18 240)' : value >= 30 ? 'var(--day-pressure)' : 'var(--border)'
  return (
    <div style={{ height, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  )
}

export default function SubjectsScreen({ onSave }) {
  const [subjects, setSubjects] = useState([])
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubject, setNewSubject] = useState({ name: '', description: '' })
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSubjects() }, [])

  async function loadSubjects() {
    setLoading(true)
    try {
      const subs = await db.subjects.toArray()
      const result = []
      for (const sub of subs) {
        const topics = await db.topics.where('subjectId').equals(sub.id).toArray()
        let totalLectures = 0, completedLectures = 0, lastStudied = null
        for (const topic of topics) {
          const lectures = await db.lectures.where('topicId').equals(topic.id).toArray()
          totalLectures += lectures.length
          completedLectures += lectures.filter(l => l.watched).length
          lectures.forEach(l => { if (l.lastStudied && (!lastStudied || l.lastStudied > lastStudied)) lastStudied = l.lastStudied })
        }
        result.push({ ...sub, topicsCount: topics.length, totalLectures, completedLectures, progress: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0, lastStudied })
      }
      setSubjects(result)
    } catch {}
    setLoading(false)
  }

  async function handleAddSubject() {
    if (!newSubject.name.trim()) return
    const id = await db.subjects.add({ name: newSubject.name.trim(), description: newSubject.description.trim() })
    setNewSubject({ name: '', description: '' }); setShowAddSubject(false); loadSubjects()
    onSave?.('subjects', { id, name: newSubject.name.trim(), description: newSubject.description.trim() })
  }

  async function handleDeleteSubject(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this subject and all its topics/lectures?')) return
    const topics = await db.topics.where('subjectId').equals(id).toArray()
    for (const t of topics) await db.lectures.where('topicId').equals(t.id).delete()
    await db.topics.where('subjectId').equals(id).delete()
    await db.subjects.delete(id)
    loadSubjects()
    onSave?.('_push_table', 'subjects'); onSave?.('_push_table', 'topics'); onSave?.('_push_table', 'lectures')
  }

  if (selectedSubject) return <SubjectDetailScreen subject={selectedSubject} onBack={() => { setSelectedSubject(null); loadSubjects() }} onSave={onSave} />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', padding: '20px 16px 24px', position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--primary)', marginBottom: '2px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Exam Prep</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--fg)' }}>Subjects</p>
          <div style={{ background: 'oklch(83% .17 75 / .12)', borderRadius: '20px', padding: '5px 14px', border: '1px solid oklch(83% .17 75 / .3)' }}>
            <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>{subjects.length} subjects</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '96px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted-fg)', fontWeight: '500' }}>Loading...</div>
        ) : subjects.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ fontSize: '17px', fontWeight: '900', color: 'var(--fg)', marginBottom: '6px' }}>No subjects yet</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', fontWeight: '500' }}>Tap + to add your first subject</p>
          </div>
        ) : subjects.map(sub => (
          <div key={sub.id} onClick={() => setSelectedSubject(sub)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '18px', marginBottom: '12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--fg)', marginBottom: '2px' }}>{sub.name}</p>
                {sub.description ? <p style={{ fontSize: '12px', color: 'var(--muted-fg)', fontWeight: '500' }}>{sub.description}</p> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: sub.progress >= 80 ? 'oklch(65% .16 155 / .15)' : sub.progress >= 50 ? 'oklch(65% .18 240 / .15)' : sub.progress >= 30 ? 'oklch(78% .16 50 / .15)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: '900', color: sub.progress >= 80 ? 'oklch(65% .16 155)' : sub.progress >= 50 ? 'oklch(65% .18 240)' : sub.progress >= 30 ? 'var(--day-pressure)' : 'var(--muted-fg)' }}>{sub.progress}%</p>
                </div>
                <button onClick={(e) => handleDeleteSubject(sub.id, e)} style={{ background: 'oklch(68% .22 22 / .15)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} color='var(--priority-high)' />
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}><ProgressBar value={sub.progress} height={6} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={12} color='oklch(65% .18 240)' />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'oklch(65% .18 240)' }}>{sub.topicsCount} topics</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Video size={12} color='oklch(65% .15 280)' />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'oklch(65% .15 280)' }}>{sub.completedLectures}/{sub.totalLectures} lectures</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} color='var(--muted-fg)' />
                <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted-fg)' }}>{getLastStudiedText(sub.lastStudied)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddSubject(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '414px', border: '1px solid var(--border)' }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '99px', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--fg)', marginBottom: '20px' }}>Add Subject</p>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject Name *</p>
            <input value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="e.g. COA, Aptitude, DBMS"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '14px', boxSizing: 'border-box', background: 'var(--surface-2)', fontWeight: '700' }} />
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description (optional)</p>
            <input value={newSubject.description} onChange={e => setNewSubject({ ...newSubject, description: e.target.value })} placeholder="e.g. Computer Organization & Architecture"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '24px', boxSizing: 'border-box', background: 'var(--surface-2)' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddSubject(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-fg)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAddSubject} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Add Subject</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowAddSubject(true)} style={{ position: 'fixed', bottom: '88px', right: '16px', width: '54px', height: '54px', borderRadius: '50%', background: 'var(--gradient-hero)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px oklch(83% .17 75 / .4)', zIndex: 100 }}>
        <Plus size={24} color='oklch(16% .02 270)' />
      </button>
    </div>
  )
}

// ─── Subject Detail ───────────────────────────────────────────────────────────
function SubjectDetailScreen({ subject, onBack, onSave }) {
  const [topics, setTopics] = useState([])
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [newTopic, setNewTopic] = useState({ name: '', totalLectures: '' })
  const [selectedTopic, setSelectedTopic] = useState(null)

  useEffect(() => { loadTopics() }, [])

  async function loadTopics() {
    const topicList = await db.topics.where('subjectId').equals(subject.id).toArray()
    const result = []
    for (const t of topicList) {
      const lectures = await db.lectures.where('topicId').equals(t.id).toArray()
      const completed = lectures.filter(l => l.watched).length
      result.push({ ...t, lecturesCount: lectures.length, completedCount: completed, notesMade: lectures.filter(l => l.notesMade).length, questionsSolved: lectures.filter(l => l.questionsSolved).length, revisionDone: lectures.filter(l => l.revisionDone).length, progress: lectures.length > 0 ? Math.round((completed / lectures.length) * 100) : 0 })
    }
    setTopics(result)
  }

  async function handleAddTopic() {
    if (!newTopic.name.trim() || !newTopic.totalLectures) return
    const topicId = await db.topics.add({ subjectId: subject.id, name: newTopic.name.trim(), totalLectures: Number(newTopic.totalLectures) })
    const entries = []
    for (let i = 1; i <= Number(newTopic.totalLectures); i++) entries.push({ topicId, subjectId: subject.id, name: `Lecture ${i}`, watched: false, notesMade: false, questionsSolved: false, revisionDone: false, lastStudied: null })
    await db.lectures.bulkAdd(entries)
    setNewTopic({ name: '', totalLectures: '' }); setShowAddTopic(false); loadTopics()
    onSave?.('topics', { id: topicId, subjectId: subject.id, name: newTopic.name.trim(), totalLectures: Number(newTopic.totalLectures) })
    onSave?.('_push_table', 'lectures')
  }

  async function handleDeleteTopic(id, e) {
    e.stopPropagation()
    await db.lectures.where('topicId').equals(id).delete()
    await db.topics.delete(id)
    loadTopics()
    onSave?.('_push_table', 'topics'); onSave?.('_push_table', 'lectures')
  }

  if (selectedTopic) return <TopicDetailScreen topic={selectedTopic} onBack={() => { setSelectedTopic(null); loadTopics() }} onSave={onSave} />

  const totalLectures = topics.reduce((s, t) => s + t.lecturesCount, 0)
  const doneLectures  = topics.reduce((s, t) => s + t.completedCount, 0)
  const overallProgress = totalLectures > 0 ? Math.round((doneLectures / totalLectures) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'var(--surface)', padding: '20px 16px 28px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
          <ArrowLeft size={16} color='var(--muted-fg)' />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted-fg)', fontFamily: 'Inter, sans-serif' }}>Subjects</span>
        </button>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--primary)', marginBottom: '2px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Subject</p>
        <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--fg)', marginBottom: '14px' }}>{subject.name}</p>
        <div style={{ background: 'var(--surface-2)', borderRadius: '14px', padding: '12px 16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)' }}>{doneLectures}/{totalLectures} lectures complete</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)' }}>{overallProgress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallProgress}%`, background: 'var(--primary)', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '96px' }}>
        {topics.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', border: '1px solid var(--border)', marginTop: '8px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📖</div>
            <p style={{ fontSize: '16px', fontWeight: '900', color: 'var(--fg)', marginBottom: '4px' }}>No topics yet</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-fg)', fontWeight: '500' }}>Tap + to add topics with lectures</p>
          </div>
        ) : topics.map(topic => (
          <div key={topic.id} onClick={() => setSelectedTopic(topic)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '16px', marginBottom: '10px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--fg)', marginBottom: '6px' }}>{topic.name}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: `${topic.completedCount}/${topic.lecturesCount} watched`, color: 'oklch(65% .18 240)', bg: 'oklch(65% .18 240 / .15)' },
                    { label: `${topic.notesMade} notes`,   color: 'oklch(65% .15 280)', bg: 'oklch(65% .15 280 / .15)' },
                    { label: `${topic.questionsSolved} Q`, color: 'var(--day-pressure)', bg: 'oklch(78% .16 50 / .12)' },
                    { label: `${topic.revisionDone} rev`,  color: 'oklch(65% .16 155)', bg: 'oklch(65% .16 155 / .15)' },
                  ].map(chip => (
                    <span key={chip.label} style={{ fontSize: '11px', fontWeight: '700', color: chip.color, background: chip.bg, borderRadius: '20px', padding: '3px 9px' }}>{chip.label}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: topic.progress >= 80 ? 'oklch(65% .16 155 / .15)' : topic.progress >= 50 ? 'oklch(65% .18 240 / .15)' : 'oklch(78% .16 50 / .12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: topic.progress >= 80 ? 'oklch(65% .16 155)' : topic.progress >= 50 ? 'oklch(65% .18 240)' : 'var(--day-pressure)' }}>{topic.progress}%</span>
                </div>
                <button onClick={(e) => handleDeleteTopic(topic.id, e)} style={{ background: 'oklch(68% .22 22 / .15)', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} color='var(--priority-high)' />
                </button>
              </div>
            </div>
            <div style={{ height: '5px', background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${topic.progress}%`, background: topic.progress >= 80 ? 'oklch(65% .16 155)' : topic.progress >= 50 ? 'oklch(65% .18 240)' : 'var(--day-pressure)', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {showAddTopic && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddTopic(false) }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '414px', border: '1px solid var(--border)' }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '99px', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--fg)', marginBottom: '20px' }}>Add Topic — {subject.name}</p>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic Name *</p>
            <input value={newTopic.name} onChange={e => setNewTopic({ ...newTopic, name: e.target.value })} placeholder="e.g. CPU, Memory, I/O"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '14px', boxSizing: 'border-box', background: 'var(--surface-2)', fontWeight: '700' }} />
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Lectures *</p>
            <input type="number" value={newTopic.totalLectures} onChange={e => setNewTopic({ ...newTopic, totalLectures: e.target.value })} placeholder="e.g. 5"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '15px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '24px', boxSizing: 'border-box', background: 'var(--surface-2)', fontWeight: '700', colorScheme: 'dark' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddTopic(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-fg)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleAddTopic} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Add Topic</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowAddTopic(true)} style={{ position: 'fixed', bottom: '88px', right: '16px', width: '54px', height: '54px', borderRadius: '50%', background: 'var(--gradient-hero)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px oklch(83% .17 75 / .4)', zIndex: 100 }}>
        <Plus size={24} color='oklch(16% .02 270)' />
      </button>
    </div>
  )
}

// ─── Topic Detail ─────────────────────────────────────────────────────────────
function TopicDetailScreen({ topic, onBack, onSave }) {
  const [lectures, setLectures] = useState([])

  useEffect(() => { loadLectures() }, [])

  async function loadLectures() {
    const list = await db.lectures.where('topicId').equals(topic.id).toArray()
    setLectures(list.sort((a, b) => a.id - b.id))
  }

  async function toggleField(lectureId, field) {
    const lecture = lectures.find(l => l.id === lectureId)
    if (!lecture) return
    const updated = { [field]: !lecture[field] }
    if (field === 'watched' && !lecture.watched) updated.lastStudied = new Date().toISOString()
    await db.lectures.update(lectureId, updated)
    loadLectures()
    onSave?.('lectures', { ...lecture, ...updated })
  }

  const fields = [
    { key: 'watched',        label: '👁 Watched', color: 'oklch(65% .18 240)', activeBg: 'oklch(65% .18 240 / .2)' },
    { key: 'notesMade',      label: '📝 Notes',   color: 'oklch(65% .15 280)', activeBg: 'oklch(65% .15 280 / .2)' },
    { key: 'questionsSolved',label: '❓ Solved',  color: 'var(--day-pressure)',activeBg: 'oklch(78% .16 50 / .2)' },
    { key: 'revisionDone',   label: '🔄 Revised', color: 'oklch(65% .16 155)', activeBg: 'oklch(65% .16 155 / .2)' },
  ]

  const watchedCount = lectures.filter(l => l.watched).length
  const progress = lectures.length > 0 ? Math.round((watchedCount / lectures.length) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'var(--surface)', padding: '20px 16px 28px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
          <ArrowLeft size={16} color='var(--muted-fg)' />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted-fg)', fontFamily: 'Inter, sans-serif' }}>Topics</span>
        </button>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--primary)', marginBottom: '2px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Topic</p>
        <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--fg)', marginBottom: '14px' }}>{topic.name}</p>
        <div style={{ background: 'var(--surface-2)', borderRadius: '14px', padding: '12px 16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)' }}>{watchedCount}/{lectures.length} watched</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--primary)' }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '32px' }}>
        {lectures.map((lecture, idx) => (
          <div key={lecture.id} style={{ background: lecture.watched ? 'oklch(65% .16 155 / .08)' : 'var(--surface)', border: `1.5px solid ${lecture.watched ? 'oklch(65% .16 155 / .3)' : 'var(--border)'}`, borderRadius: '16px', padding: '14px 16px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '15px', fontWeight: '700', color: lecture.watched ? 'var(--muted-fg)' : 'var(--fg)', textDecoration: lecture.watched ? 'line-through' : 'none' }}>
                Lecture {idx + 1}
              </p>
              {lecture.watched && <span style={{ fontSize: '11px', fontWeight: '700', color: 'oklch(65% .16 155)', background: 'oklch(65% .16 155 / .15)', borderRadius: '20px', padding: '2px 9px' }}>Done ✓</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fields.map(f => (
                <button key={f.key} onClick={() => toggleField(lecture.id, f.key)} style={{ padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: '600', background: lecture[f.key] ? f.activeBg : 'var(--surface-2)', color: lecture[f.key] ? f.color : 'var(--muted-fg)', transition: 'all 0.15s' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}