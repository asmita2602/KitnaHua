import HamburgerMenu from './HamburgerMenu'

export default function TopBar({ totalPoints = 0 }) {
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
      {/* Left — Coins */}
      <div style={{
        background: '#1e293b',
        borderRadius: '20px',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <span style={{ fontSize: '15px' }}>🪙</span>
        <span style={{
          fontSize: '13px', fontWeight: '800',
          color: '#38bdf8', fontFamily: 'Nunito, sans-serif',
        }}>
          {totalPoints.toLocaleString()}
        </span>
      </div>

      {/* Center — App Name */}
      <p style={{
        fontSize: '22px',
        fontWeight: '800',
        color: '#38bdf8',
        fontFamily: 'Nunito, sans-serif',
        letterSpacing: '0.5px',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
      }}>
        KitnaHua
      </p>

      {/* Right — Hamburger */}
      <HamburgerMenu />
    </div>
  )
}