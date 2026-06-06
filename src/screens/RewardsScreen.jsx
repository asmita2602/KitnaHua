import { useState, useEffect } from 'react'
import { Plus, X, Gift, Zap, Flame } from 'lucide-react'
import { db } from '../db'

const PRESET_REWARDS = [
  { name: 'Ice Cream 🍦', cost: 300, emoji: '🍦' },
  { name: 'Chips 🍟', cost: 200, emoji: '🍟' },
  { name: 'Movie 🎬', cost: 1000, emoji: '🎬' },
  { name: 'Rest Day 😴', cost: 2000, emoji: '😴' },
]

function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

export default function RewardsScreen() {
  const today = getTodayString()
  const [totalPoints, setTotalPoints] = useState(0)
  const [studyStreak, setStudyStreak] = useState(0)
  const [exerciseStreak, setExerciseStreak] = useState(0)
  const [rewards, setRewards] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [showAddReward, setShowAddReward] = useState(false)
  const [newReward, setNewReward] = useState({ name: '', cost: '' })
  const [toastMsg, setToastMsg] = useState(null)
  const [redeemedToday, setRedeemedToday] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Points from completed tasks
    const allTasks = await db.tasks.toArray()
    const pts = allTasks
      .filter(t => t.completed && t.date !== 'template')
      .reduce((sum, t) => sum + (t.points || 0), 0)

    // Subtract redeemed points
    let redeemedPts = 0
    let todayRedeemed = false
    let redemptionList = []
    try {
      const allRedemptions = await db.redemptions?.toArray?.() || []
      redemptionList = allRedemptions
      redeemedPts = allRedemptions.reduce((sum, r) => sum + (r.cost || 0), 0)
      todayRedeemed = allRedemptions.some(r => r.date === today)
    } catch {}

    setTotalPoints(Math.max(0, pts - redeemedPts))
    setRedeemedToday(todayRedeemed)
    setRedemptions(redemptionList)

    // Load custom rewards
    let customRewards = []
    try { customRewards = await db.rewards?.toArray?.() || [] } catch {}
    setRewards([...PRESET_REWARDS.map((r, i) => ({ ...r, id: `preset-${i}`, isPreset: true })),
      ...customRewards.map(r => ({ ...r, isPreset: false }))])

    // Streaks — count consecutive days with study/exercise feedback
    const feedback = []
    try {
      const all = await db.feedback?.toArray?.() || []
      feedback.push(...all)
    } catch {}

    const sortedDates = feedback.map(f => f.date).sort().reverse()
    let sStreak = 0, eStreak = 0
    const todayD = new Date(today)
    for (let i = 0; ; i++) {
      const d = new Date(todayD)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const rec = feedback.find(f => f.date === ds)
      if (!rec) break
      if (rec.study?.actualHours > 0) sStreak++
      else if (i > 0) break
    }
    for (let i = 0; ; i++) {
      const d = new Date(todayD)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const rec = feedback.find(f => f.date === ds)
      if (!rec) break
      if (rec.exercise?.actualDuration > 0) eStreak++
      else if (i > 0) break
    }
    setStudyStreak(sStreak)
    setExerciseStreak(eStreak)
  }

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  async function handleRedeem(reward) {
    if (redeemedToday) {
      showToast('Reward already redeemed today. Come back tomorrow! 🌟')
      return
    }
    if (totalPoints < reward.cost) {
      showToast('Not enough points to redeem this reward.')
      return
    }
    try {
      await db.redemptions?.add?.({ name: reward.name, cost: reward.cost, date: today })
    } catch {}
    showToast(`${reward.name} redeemed! 🎉 −${reward.cost} pts`)
    loadData()
  }

  async function handleAddReward() {
    if (!newReward.name.trim() || !newReward.cost) return
    try {
      await db.rewards?.add?.({ name: newReward.name.trim(), cost: Number(newReward.cost) })
    } catch {}
    setNewReward({ name: '', cost: '' })
    setShowAddReward(false)
    loadData()
  }

  async function handleDeleteReward(id) {
    try { await db.rewards?.delete?.(id) } catch {}
    loadData()
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '80px', fontFamily: 'Nunito, sans-serif' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', borderRadius: '12px',
          padding: '12px 20px', fontSize: '13px', fontWeight: '700',
          zIndex: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontFamily: 'Nunito, sans-serif', whiteSpace: 'nowrap',
        }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Gamification</p>
        <p style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>Rewards</p>
      </div>

      {/* Wallet Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '20px', padding: '20px', marginBottom: '14px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: '-20px', top: '-20px',
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'rgba(56,189,248,0.08)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Zap size={18} color='#38bdf8' />
          <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>
            Reward Wallet
          </p>
        </div>
        <p style={{ fontSize: '40px', fontWeight: '900', color: '#fff', fontFamily: 'Nunito, sans-serif' }}>
          {totalPoints.toLocaleString()}
        </p>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', fontFamily: 'Nunito, sans-serif' }}>
          points available
        </p>
        {redeemedToday && (
          <div style={{
            marginTop: '10px', background: 'rgba(56,189,248,0.15)',
            borderRadius: '8px', padding: '6px 10px', display: 'inline-block',
          }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', fontFamily: 'Nunito, sans-serif' }}>
              ✓ Reward redeemed today
            </p>
          </div>
        )}
      </div>

  
      {/* Reward Catalog */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>Reward Catalog</p>
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: '8px', padding: '4px 10px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>
            1 reward/day max
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {rewards.map((reward, idx) => {
          const canAfford = totalPoints >= reward.cost
          return (
            <div key={reward.id || idx} style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '16px', padding: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '8px', position: 'relative',
            }}>
              {!reward.isPreset && (
                <button
                  onClick={() => handleDeleteReward(reward.id)}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: '#fff5f5', border: 'none', borderRadius: '6px',
                    width: '22px', height: '22px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={12} color='#ef4444' />
                </button>
              )}
              <p style={{ fontSize: '28px' }}>{reward.emoji || '🎁'}</p>
              <p style={{
                fontSize: '13px', fontWeight: '800', color: '#0f172a',
                textAlign: 'center', fontFamily: 'Nunito, sans-serif',
              }}>
                {reward.name.replace(/[^\w\s]/g, '').trim() || reward.name}
              </p>
              <div style={{
                background: '#fef9c3', borderRadius: '20px', padding: '3px 10px',
              }}>
                <p style={{ fontSize: '12px', fontWeight: '800', color: '#854d0e', fontFamily: 'Nunito, sans-serif' }}>
                  {reward.cost} 🪙 
                </p>
              </div>
              <button
                onClick={() => handleRedeem(reward)}
                style={{
                  width: '100%', padding: '8px', borderRadius: '10px',
                  border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed',
                  background: canAfford ? '#0f172a' : '#f1f5f9',
                  color: canAfford ? '#fff' : '#94a3b8',
                  fontSize: '12px', fontWeight: '700',
                  fontFamily: 'Nunito, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {canAfford ? 'Redeem' : 'Need more pts'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Recent Redemptions */}
      {redemptions.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
            Recent Redemptions
          </p>
          {redemptions.slice().reverse().slice(0, 5).map((r, i) => (
            <div key={i} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '12px 14px', marginBottom: '8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Gift size={16} color='#94a3b8' />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
                    {r.name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'Nunito, sans-serif' }}>
                    {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '13px', fontWeight: '800', color: '#ef4444', fontFamily: 'Nunito, sans-serif' }}>
                −{r.cost} 🏆
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Reward Modal */}
      {showAddReward && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddReward(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '20px', width: '100%', maxWidth: '414px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', fontFamily: 'Nunito, sans-serif' }}>
                Create Reward
              </p>
              <button onClick={() => setShowAddReward(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: '8px',
                width: '32px', height: '32px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} color='#64748b' />
              </button>
            </div>

            <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px', fontFamily: 'Nunito, sans-serif' }}>
              Reward Name
            </p>
            <input
              value={newReward.name}
              onChange={e => setNewReward({ ...newReward, name: e.target.value })}
              placeholder="e.g. Favourite snack 🍫"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1px solid #e2e8f0', fontSize: '14px',
                fontFamily: 'Nunito, sans-serif', outline: 'none',
                color: '#0f172a', marginBottom: '12px', boxSizing: 'border-box',
              }}
            />

            <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px', fontFamily: 'Nunito, sans-serif' }}>
              Point Cost
            </p>
            <input
              type="number"
              value={newReward.cost}
              onChange={e => setNewReward({ ...newReward, cost: e.target.value })}
              placeholder="e.g. 500"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1px solid #e2e8f0', fontSize: '14px',
                fontFamily: 'Nunito, sans-serif', outline: 'none',
                color: '#0f172a', marginBottom: '20px', boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAddReward(false)} style={{
                flex: 1, padding: '12px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: '#f8fafc',
                color: '#64748b', fontSize: '14px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
              }}>Cancel</button>
              <button onClick={handleAddReward} style={{
                flex: 2, padding: '12px', borderRadius: '10px',
                border: 'none', background: '#0f172a',
                color: '#fff', fontSize: '14px', fontWeight: '700',
                cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
              }}>Create Reward</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddReward(true)}
        style={{
          position: 'fixed', bottom: '80px', right: 'calc(50% - 199px)',
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#0f172a', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(15,23,42,0.3)', zIndex: 100,
        }}
      >
        <Plus size={24} color='#38bdf8' />
      </button>
    </div>
  )
}
