import HamburgerMenu from './HamburgerMenu'
import { RefreshCw } from 'lucide-react'

export default function TopBar({ totalPoints = 0, syncStatus = 'ok', onManualSync }) {
  return (
    <div style={{
      background: '#0f172a',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Left — Coins + Sync */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          background: '#1e293b', borderRadius: '20px',
          padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span style={{ fontSize: '15px' }}>🪙</span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', fontFamily: 'Nunito, sans-serif' }}>
            {totalPoints.toLocaleString()}
          </span>
        </div>

        {/* Sync status dot */}
        <button
          onClick={onManualSync}
          title="Tap to sync"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px',
          }}
        >
          <RefreshCw
            size={14}
            color={syncStatus === 'ok' ? '#22c55e' : syncStatus === 'error' ? '#ef4444' : '#f97316'}
            style={{
              animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>

      {/* Center — App Name */}
      <p style={{
        fontSize: '22px', fontWeight: '800', color: '#38bdf8',
        fontFamily: 'Nunito, sans-serif', letterSpacing: '0.5px',
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      }}>
        KitnaHua
      </p>

      {/* Right — Hamburger */}
      <HamburgerMenu />
    </div>
  )
}