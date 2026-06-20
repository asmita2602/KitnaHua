import { useState, useEffect } from 'react'
import { Plus, X, Flame, Trash2 } from 'lucide-react'
import { db } from '../db'
import { localDateString } from '../utils'

const PRESET_REWARDS = [
  { name: 'Ice Cream', cost: 300, emoji: '🍦' },
  { name: 'Chips', cost: 200, emoji: '🍟' },
  { name: 'Movie', cost: 1000, emoji: '🎬' },
  { name: 'Rest Day', cost: 2000, emoji: '😴' },
]

const EMOJI_OPTIONS = ['🎬','🍕','🛍️','🍦','🍟','😴','🎮','📚','🏆','🎁','🍰','☕','🎵','✈️','🏖️']

export default function RewardsScreen() {
  const today = localDateString()
  const [totalPoints, setTotalPoints] = useState(0)
  const [studyStreak, setStudyStreak] = useState(0)
  const [exerciseStreak, setExerciseStreak] = useState(0)
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [showAddReward, setShowAddReward] = useState(false)
  const [editingReward, setEditingReward] = useState(null)
  const [newReward, setNewReward] = useState({ name: '', cost: '', emoji: '🎁' })
  const [toastMsg, setToastMsg] = useState(null)
  const [redeemedToday, setRedeemedToday] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const allTasks = await db.tasks.toArray()
    const pts = allTasks.filter(t => t.completed && t.date !== 'template').reduce((sum, t) => sum + (Number(t.points) || 0), 0)
    let redeemedPts = 0, todayRedeemed = false, redemptionList = []
    try {
      const allRedemptions = await db.redemptions?.toArray?.() || []
      redemptionList = allRedemptions
      redeemedPts = allRedemptions.reduce((sum, r) => sum + (r.cost || 0), 0)
      todayRedeemed = allRedemptions.some(r => r.date === today)
    } catch {}
    setTotalPoints(Math.max(0, pts - redeemedPts))
    setRedeemedToday(todayRedeemed)
    setRedemptions(redemptionList)

    let customRewards = []
    try { customRewards = await db.rewards?.toArray?.() || [] } catch {}
    setRewards([
      ...PRESET_REWARDS.map((r, i) => ({ ...r, id: `preset-${i}`, isPreset: true })),
      ...customRewards.map(r => ({ ...r, isPreset: false })),
    ])

    const feedback = []
    try { const all = await db.feedback?.toArray?.() || []; feedback.push(...all) } catch {}
    const todayFb = feedback.find(f => f.date === today)
    const startOffset = todayFb ? 0 : 1

    let sStreak = 0
    for (let i = startOffset; ; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = localDateString(d)
      const rec = feedback.find(f => f.date === ds)
      const hrs = rec?.studySlots?.reduce((s, sl) => s + (parseFloat(sl.actualHours) || 0), 0) || parseFloat(rec?.study?.actualHours || 0)
      if (!rec || hrs <= 0) break
      sStreak++
    }

    let eStreak = 0
    for (let i = startOffset; ; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = localDateString(d)
      const rec = feedback.find(f => f.date === ds)
      if (!rec || !rec.exercise?.actualDuration || parseFloat(rec.exercise.actualDuration) <= 0) break
      eStreak++
    }

    setStudyStreak(sStreak)
    setExerciseStreak(eStreak)
  }

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500) }

  async function handleRedeem(reward) {
    if (redeemedToday) { showToast('Reward already redeemed today. Come back tomorrow! 🌟'); return }
    if (totalPoints < reward.cost) { showToast('Not enough points to redeem this reward.'); return }
    try { await db.redemptions?.add?.({ name: reward.name, cost: reward.cost, date: today, emoji: reward.emoji }) } catch {}
    showToast(`${reward.emoji} ${reward.name} redeemed! −${reward.cost} pts`)
    loadData()
  }

  async function handleSaveReward() {
    if (!newReward.name.trim() || !newReward.cost) return
    try {
      if (editingReward && !editingReward.isPreset) {
        await db.rewards?.update?.(editingReward.id, { name: newReward.name.trim(), cost: Number(newReward.cost), emoji: newReward.emoji })
      } else {
        await db.rewards?.add?.({ name: newReward.name.trim(), cost: Number(newReward.cost), emoji: newReward.emoji })
      }
    } catch {}
    setNewReward({ name: '', cost: '', emoji: '🎁' }); setEditingReward(null); setShowAddReward(false); loadData()
  }

  async function handleDeleteReward(id) { try { await db.rewards?.delete?.(id) } catch {}; loadData() }

  function openEdit(reward) {
    setEditingReward(reward)
    setNewReward({ name: reward.name, cost: String(reward.cost), emoji: reward.emoji || '🎁' })
    setShowAddReward(true)
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px', fontFamily: 'Inter, sans-serif' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-2)', color: 'var(--fg)', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', fontWeight: '600', zIndex: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--muted-fg)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '2px' }}>Gamification</p>
        <p style={{ fontSize: '22px', fontWeight: '900', color: 'var(--fg)' }}>Rewards</p>
      </div>

      {/* Points Card */}
      <div style={{ background: 'var(--gradient-card)', borderRadius: '20px', padding: '20px', marginBottom: '14px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'oklch(83% .17 75 / .08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Flame size={16} color='var(--primary)' />
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted-fg)', fontFamily: 'Inter, sans-serif' }}>Reward Points</p>
        </div>
        <p style={{ fontSize: '40px', fontWeight: '900', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>{totalPoints.toLocaleString()}</p>
        <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>points available</p>
        {redeemedToday && (
          <div style={{ marginTop: '10px', background: 'oklch(83% .17 75 / .12)', borderRadius: '8px', padding: '6px 10px', display: 'inline-block', border: '1px solid oklch(83% .17 75 / .3)' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>✓ Reward redeemed today</p>
          </div>
        )}
      </div>

      {/* Streak Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Study Streak', value: studyStreak, color: 'oklch(65% .18 240)', bg: 'oklch(65% .18 240 / .12)', border: 'oklch(65% .18 240 / .25)' },
          { label: 'Exercise Streak', value: exerciseStreak, color: 'oklch(65% .16 155)', bg: 'oklch(65% .16 155 / .12)', border: 'oklch(65% .16 155 / .25)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: `1px solid ${s.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Flame size={14} color={s.color} />
              <p style={{ fontSize: '11px', fontWeight: '700', color: s.color, fontFamily: 'Inter, sans-serif' }}>{s.label}</p>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '900', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>{s.value}</p>
            <p style={{ fontSize: '11px', color: 'var(--muted-fg)', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>{s.value === 1 ? 'day' : 'days'}</p>
          </div>
        ))}
      </div>

      {/* Catalog Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ fontSize: '16px', fontWeight: '800', color: 'var(--fg)' }}>Reward Catalog</p>
        <div style={{ background: 'oklch(65% .16 155 / .12)', border: '1px solid oklch(65% .16 155 / .3)', borderRadius: '8px', padding: '4px 10px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: 'oklch(75% .14 155)' }}>1 reward/day max</p>
        </div>
      </div>

      {/* Reward Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {rewards.map((reward, idx) => {
          const canAfford = totalPoints >= reward.cost
          return (
            <div key={reward.id || idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
              {!reward.isPreset && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                  <button onClick={() => openEdit(reward)} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '6px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>✏️</button>
                  <button onClick={() => handleDeleteReward(reward.id)} style={{ background: 'oklch(68% .22 22 / .15)', border: 'none', borderRadius: '6px', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={11} color='var(--priority-high)' />
                  </button>
                </div>
              )}
              <p style={{ fontSize: '28px' }}>{reward.emoji || '🎁'}</p>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--fg)', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>{reward.name}</p>
              <div style={{ background: 'oklch(83% .17 75 / .15)', borderRadius: '20px', padding: '3px 10px', border: '1px solid oklch(83% .17 75 / .25)' }}>
                <p style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>{reward.cost} pts</p>
              </div>
              <button onClick={() => handleRedeem(reward)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed', background: canAfford ? 'var(--gradient-hero)' : 'var(--surface-2)', color: canAfford ? 'oklch(16% .02 270)' : 'var(--muted-fg)', fontSize: '12px', fontWeight: '700', fontFamily: 'Inter, sans-serif' }}>
                {canAfford ? 'Redeem' : 'Need more pts'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Recent Redemptions */}
      {redemptions.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--fg)', marginBottom: '10px' }}>Recent Redemptions</p>
          {redemptions.slice().reverse().slice(0, 5).map((r, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <p style={{ fontSize: '20px' }}>{r.emoji || '🎁'}</p>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>{r.name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--muted-fg)', fontFamily: 'Inter, sans-serif' }}>
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--priority-high)', fontFamily: 'Inter, sans-serif' }}>−{r.cost} pts</p>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddReward && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddReward(false); setEditingReward(null) } }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '414px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '17px', fontWeight: '800', color: 'var(--fg)', fontFamily: 'Inter, sans-serif' }}>
                {editingReward ? 'Edit Reward' : 'Create Reward'}
              </p>
              <button onClick={() => { setShowAddReward(false); setEditingReward(null) }} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color='var(--muted-fg)' />
              </button>
            </div>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pick Emoji</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewReward({ ...newReward, emoji: e })} style={{ fontSize: '22px', padding: '4px 8px', borderRadius: '10px', border: `2px solid ${newReward.emoji === e ? 'var(--primary)' : 'transparent'}`, background: newReward.emoji === e ? 'oklch(83% .17 75 / .15)' : 'var(--surface-2)', cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reward Name</p>
            <input value={newReward.name} onChange={e => setNewReward({ ...newReward, name: e.target.value })} placeholder="e.g. Watch Movie"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '12px', boxSizing: 'border-box', background: 'var(--surface-2)' }} />
            <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted-fg)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points Required</p>
            <input type="number" value={newReward.cost} onChange={e => setNewReward({ ...newReward, cost: e.target.value })} placeholder="e.g. 500"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--fg)', marginBottom: '20px', boxSizing: 'border-box', background: 'var(--surface-2)', colorScheme: 'dark' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowAddReward(false); setEditingReward(null) }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-fg)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              <button onClick={handleSaveReward} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: 'var(--gradient-hero)', color: 'oklch(16% .02 270)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {editingReward ? 'Save Changes' : 'Create Reward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setNewReward({ name: '', cost: '', emoji: '🎁' }); setEditingReward(null); setShowAddReward(true) }} style={{ position: 'fixed', bottom: '84px', right: 'calc(50% - 191px)', width: '54px', height: '54px', borderRadius: '50%', background: 'var(--gradient-hero)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px oklch(83% .17 75 / .4)', zIndex: 100 }}>
        <Plus size={24} color='oklch(16% .02 270)' />
      </button>
    </div>
  )
}