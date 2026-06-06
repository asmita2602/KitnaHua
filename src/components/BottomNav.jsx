import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Calendar, MessageSquare, BookOpen, BarChart2 } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/feedback', label: 'Feedback', icon: MessageSquare },
  { path: '/subjects', label: 'Subjects', icon: BookOpen },
  { path: '/insights', label: 'Insights', icon: BarChart2 },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '414px',
      maxWidth: '100vw',
      background: '#0f172a',
      borderTop: '1px solid #1e293b',
      zIndex: 50,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: '8px',
        paddingBottom: '8px',
      }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#38bdf8' : '#475569',
                padding: '4px 8px',
              }}
            >
              <Icon size={20} />
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? '700' : '400',
                fontFamily: 'Nunito, sans-serif',
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}