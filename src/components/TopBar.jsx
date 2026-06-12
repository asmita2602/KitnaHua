import HamburgerMenu from './HamburgerMenu'

function GoldCoin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="8" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#92400E">₹</text>
    </svg>
  )
}

export default function TopBar({ totalPoints = 0, onExport, onImport }) {
  return (
    <div style={{
      background: '#0f172a', padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <p style={{ fontSize: '18px', fontWeight: '900', color: '#38bdf8', fontFamily: 'Nunito, sans-serif' }}>
        KitnaHua
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          background: 'rgba(245,158,11,0.15)', borderRadius: '20px',
          padding: '5px 12px', border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <GoldCoin size={16} />
          <p style={{ fontSize: '13px', fontWeight: '800', color: '#F59E0B', fontFamily: 'Nunito, sans-serif' }}>
            {totalPoints.toLocaleString()}
          </p>
        </div>
        <HamburgerMenu onExport={onExport} />
      </div>
    </div>
  )
}