import { useState } from 'react'
import { Menu, X, LayoutTemplate, BarChart2, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const menuItems = [
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/study-analysis', label: 'Study Analysis', icon: BarChart2 },
  { path: '/rewards', label: 'Rewards', icon: Gift },
]

export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  function handleNavigate(path) {
    navigate(path)
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '10px',
          background: isOpen ? '#1e293b' : 'transparent',
        }}
      >
        {isOpen
          ? <X size={20} color='#38bdf8' />
          : <Menu size={20} color='#94a3b8' />
        }
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(0,0,0,0.3)',
            }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'fixed', top: '58px', right: 'calc(50% - 199px)',
            background: '#1e293b', borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 100, minWidth: '200px',
            border: '1px solid #334155', overflow: 'hidden',
          }}>
            {menuItems.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: '12px', padding: '14px 16px', border: 'none',
                    background: 'none', cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif', fontSize: '14px',
                    fontWeight: '700', color: '#e2e8f0',
                    borderBottom: idx < menuItems.length - 1 ? '1px solid #334155' : 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0f172a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Icon size={18} color='#38bdf8' />
                  {item.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}