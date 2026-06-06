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
  const color = value >= 80 ? '#22c55e' : value >= 50 ? '#3b82f6' : value >= 30 ? '#f97316' : '#cbd5e1'
  return (
    <div style={{ height, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── Main Subjects List ──────────────────────────────────────────────────────
export default function SubjectsScreen() {
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
          lectures.forEach(l => {
            if (l.lastStudied && (!lastStudied || l.lastStudied > lastStudied)) lastStudied = l.lastStudied
          })
        }
        result.push({
          ...sub,
          topicsCount: topics.length,
          totalLectures,
          completedLectures,
          progress: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0,
          lastStudied,
        })
      }
      setSubjects(result)
    } catch {}
    setLoading(false)
  }

  async function handleAddSubject() {
    if (!newSubject.name.trim()) return
    await db.subjects.add({ name: newSubject.name.trim(), description: newSubject.description.trim() })
    setNewSubject({ name: '', description: '' })
    setShowAddSubject(false)
    loadSubjects()
  }

  async function handleDeleteSubject(id, e) {
    e.stopPropagation()
    if (!window.confirm('Delete this subject and all its topics/lectures?')) return
    const topics = await db.topics.where('subjectId').equals(id).toArray()
    for (const t of topics) await db.lectures.where('topicId').equals(t.id).delete()
    await db.topics.where('subjectId').equals(id).delete()
    await db.subjects.delete(id)
    loadSubjects()
  }

  if (selectedSubject) {
    return <SubjectDetailScreen subject={selectedSubject} onBack={() => { setSelectedSubject(null); loadSubjects() }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Nunito, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '20px 16px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', marginBottom: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>Exam Prep</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>Subjects</p>
          <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: '20px', padding: '5px 14px', border: '1px solid rgba(56,189,248,0.3)' }}>
            <p style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8' }}>{subjects.length} subjects</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '96px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '600' }}>Loading...</div>
        ) : subjects.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', padding: '48px 24px', textAlign: 'center', border: '1px solid #e2e8f0', marginTop: '8px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', marginBottom: '6px' }}>No subjects yet</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tap + to add your first subject</p>
          </div>
        ) : (
          subjects.map(sub => (
            <div
              key={sub.id}
              onClick={() => setSelectedSubject(sub)}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', marginBottom: '12px', cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              {/* Title row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '2px' }}>{sub.name}</p>
                  {sub.description ? <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{sub.description}</p> : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: sub.progress >= 80 ? '#dcfce7' : sub.progress >= 50 ? '#dbeafe' : sub.progress >= 30 ? '#ffedd5' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <p style={{
                      fontSize: '12px', fontWeight: '900',
                      color: sub.progress >= 80 ? '#16a34a' : sub.progress >= 50 ? '#2563eb' : sub.progress >= 30 ? '#ea580c' : '#94a3b8',
                    }}>{sub.progress}%</p>
                  </div>
                  <button onClick={(e) => handleDeleteSubject(sub.id, e)} style={{ background: '#fff5f5', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={14} color='#ef4444' />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: '12px' }}>
                <ProgressBar value={sub.progress} height={7} />
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={12} color='#3b82f6' />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>{sub.topicsCount} topics</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Video size={12} color='#8b5cf6' />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#8b5cf6' }}>{sub.completedLectures}/{sub.totalLectures} lectures</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} color='#94a3b8' />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>{getLastStudiedText(sub.lastStudied)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddSubject(false) }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '414px' }}>
            <div style={{ width: '36px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>Add Subject</p>

            <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject Name *</p>
            <input value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="e.g. COA, Aptitude, DBMS"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', marginBottom: '14px', boxSizing: 'border-box', background: '#f8fafc', fontWeight: '700' }}
            />

            <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description (optional)</p>
            <input value={newSubject.description} onChange={e => setNewSubject({ ...newSubject, description: e.target.value })}
              placeholder="e.g. Computer Organization & Architecture"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', marginBottom: '24px', boxSizing: 'border-box', background: '#f8fafc' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddSubject(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Cancel</button>
              <button onClick={handleAddSubject} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Add Subject</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setShowAddSubject(true)} style={{ position: 'fixed', bottom: '88px', right: 'calc(50% - 199px)', width: '54px', height: '54px', borderRadius: '50%', background: '#0f172a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(15,23,42,0.35)', zIndex: 100 }}>
        <Plus size={24} color='#38bdf8' />
      </button>
    </div>
  )
}

// ─── Subject Detail (Topics) ─────────────────────────────────────────────────
function SubjectDetailScreen({ subject, onBack }) {
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
      const notesMade = lectures.filter(l => l.notesMade).length
      const questionsSolved = lectures.filter(l => l.questionsSolved).length
      const revisionDone = lectures.filter(l => l.revisionDone).length
      result.push({ ...t, lecturesCount: lectures.length, completedCount: completed, notesMade, questionsSolved, revisionDone, progress: lectures.length > 0 ? Math.round((completed / lectures.length) * 100) : 0 })
    }
    setTopics(result)
  }

  async function handleAddTopic() {
    if (!newTopic.name.trim() || !newTopic.totalLectures) return
    const topicId = await db.topics.add({ subjectId: subject.id, name: newTopic.name.trim(), totalLectures: Number(newTopic.totalLectures) })
    const entries = []
    for (let i = 1; i <= Number(newTopic.totalLectures); i++) {
      entries.push({ topicId, subjectId: subject.id, name: `Lecture ${i}`, watched: false, notesMade: false, questionsSolved: false, revisionDone: false, lastStudied: null })
    }
    await db.lectures.bulkAdd(entries)
    setNewTopic({ name: '', totalLectures: '' })
    setShowAddTopic(false)
    loadTopics()
  }

  async function handleDeleteTopic(id, e) {
    e.stopPropagation()
    await db.lectures.where('topicId').equals(id).delete()
    await db.topics.delete(id)
    loadTopics()
  }

  if (selectedTopic) return <TopicDetailScreen topic={selectedTopic} onBack={() => { setSelectedTopic(null); loadTopics() }} />

  const totalLectures = topics.reduce((s, t) => s + t.lecturesCount, 0)
  const doneLectures = topics.reduce((s, t) => s + t.completedCount, 0)
  const overallProgress = totalLectures > 0 ? Math.round((doneLectures / totalLectures) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Nunito, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '20px 16px 28px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
          <ArrowLeft size={16} color='#94a3b8' />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>Subjects</span>
        </button>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', marginBottom: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>Subject</p>
        <p style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '14px' }}>{subject.name}</p>
        {/* Overall progress */}
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>{doneLectures}/{totalLectures} lectures complete</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#38bdf8' }}>{overallProgress}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallProgress}%`, background: '#38bdf8', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '96px' }}>
        {topics.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 24px', textAlign: 'center', border: '1px solid #e2e8f0', marginTop: '8px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📖</div>
            <p style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}>No topics yet</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tap + to add topics with lectures</p>
          </div>
        ) : topics.map(topic => (
          <div key={topic.id} onClick={() => setSelectedTopic(topic)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '16px', marginBottom: '10px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>{topic.name}</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: `${topic.completedCount}/${topic.lecturesCount} watched`, color: '#3b82f6', bg: '#dbeafe' },
                    { label: `${topic.notesMade} notes`, color: '#8b5cf6', bg: '#ede9fe' },
                    { label: `${topic.questionsSolved} Q solved`, color: '#f97316', bg: '#ffedd5' },
                    { label: `${topic.revisionDone} revised`, color: '#22c55e', bg: '#dcfce7' },
                  ].map(chip => (
                    <span key={chip.label} style={{ fontSize: '11px', fontWeight: '700', color: chip.color, background: chip.bg, borderRadius: '20px', padding: '3px 9px' }}>{chip.label}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: topic.progress >= 80 ? '#dcfce7' : topic.progress >= 50 ? '#dbeafe' : '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: topic.progress >= 80 ? '#16a34a' : topic.progress >= 50 ? '#2563eb' : '#ea580c' }}>{topic.progress}%</span>
                </div>
                <button onClick={(e) => handleDeleteTopic(topic.id, e)} style={{ background: '#fff5f5', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} color='#ef4444' />
                </button>
              </div>
            </div>
            <ProgressBar value={topic.progress} height={5} />
          </div>
        ))}
      </div>

      {/* Add Topic Modal */}
      {showAddTopic && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddTopic(false) }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '414px' }}>
            <div style={{ width: '36px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 20px' }} />
            <p style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', marginBottom: '20px' }}>Add Topic — {subject.name}</p>

            <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic Name *</p>
            <input value={newTopic.name} onChange={e => setNewTopic({ ...newTopic, name: e.target.value })}
              placeholder="e.g. CPU, Memory, I/O"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', marginBottom: '14px', boxSizing: 'border-box', background: '#f8fafc', fontWeight: '700' }}
            />

            <p style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Lectures *</p>
            <input type="number" value={newTopic.totalLectures} onChange={e => setNewTopic({ ...newTopic, totalLectures: e.target.value })}
              placeholder="e.g. 5"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '15px', fontFamily: 'Nunito, sans-serif', outline: 'none', color: '#0f172a', marginBottom: '24px', boxSizing: 'border-box', background: '#f8fafc', fontWeight: '700' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddTopic(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Cancel</button>
              <button onClick={handleAddTopic} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '14px', fontWeight: '800', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Add Topic</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowAddTopic(true)} style={{ position: 'fixed', bottom: '88px', right: 'calc(50% - 199px)', width: '54px', height: '54px', borderRadius: '50%', background: '#0f172a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(15,23,42,0.35)', zIndex: 100 }}>
        <Plus size={24} color='#38bdf8' />
      </button>
    </div>
  )
}

// ─── Topic Detail (Lectures) ─────────────────────────────────────────────────
function TopicDetailScreen({ topic, onBack }) {
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
  }

  const fields = [
    { key: 'watched', label: '👁 Watched', color: '#3b82f6', bg: '#dbeafe' },
    { key: 'notesMade', label: '📝 Notes', color: '#8b5cf6', bg: '#ede9fe' },
    { key: 'questionsSolved', label: '❓ Solved', color: '#f97316', bg: '#ffedd5' },
    { key: 'revisionDone', label: '🔄 Revised', color: '#22c55e', bg: '#dcfce7' },
  ]

  const watchedCount = lectures.filter(l => l.watched).length
  const progress = lectures.length > 0 ? Math.round((watchedCount / lectures.length) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Nunito, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '20px 16px 28px' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', marginBottom: '14px' }}>
          <ArrowLeft size={16} color='#94a3b8' />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>Topics</span>
        </button>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#38bdf8', marginBottom: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>Topic</p>
        <p style={{ fontSize: '22px', fontWeight: '900', color: '#fff', marginBottom: '14px' }}>{topic.name}</p>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>{watchedCount}/{lectures.length} watched</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#38bdf8' }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#38bdf8', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '32px' }}>
        {lectures.map((lecture, idx) => (
          <div key={lecture.id} style={{
            background: lecture.watched ? '#f0fdf4' : '#fff',
            border: `1.5px solid ${lecture.watched ? '#86efac' : '#e2e8f0'}`,
            borderRadius: '16px', padding: '14px 16px', marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{
                fontSize: '15px', fontWeight: '800',
                color: lecture.watched ? '#64748b' : '#0f172a',
                textDecoration: lecture.watched ? 'line-through' : 'none',
              }}>
                Lecture {idx + 1}
              </p>
              {lecture.watched && <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', background: '#dcfce7', borderRadius: '20px', padding: '2px 9px' }}>Done ✓</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fields.map(f => (
                <button key={f.key} onClick={() => toggleField(lecture.id, f.key)} style={{
                  padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontWeight: '700',
                  background: lecture[f.key] ? f.color : '#f1f5f9',
                  color: lecture[f.key] ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s',
                }}>
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
