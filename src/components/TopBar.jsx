import HamburgerMenu from './HamburgerMenu'
import { Flame } from 'lucide-react'

export default function TopBar({ totalPoints = 0, onExport, onImport }) {
  return (
    <div style={{
      background: 'var(--surface)', padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid var(--border)',
    }}>
      <p style={{
        fontSize: '18px', fontWeight: '900', color: 'var(--fg)',
        fontFamily: 'Inter, sans-serif', letterSpacing: '2px',
      }}>
        KITNAHUA
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          background: 'oklch(83% .17 75 / .12)', borderRadius: '20px',
          padding: '5px 12px', border: '1px solid oklch(83% .17 75 / .3)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Flame size={15} color='var(--primary)' />
          <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'Inter, sans-serif' }}>
            {totalPoints.toLocaleString()}
          </p>
        </div>
        <HamburgerMenu onExport={onExport} />
      </div>
    </div>
  )
}