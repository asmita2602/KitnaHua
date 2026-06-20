import { useState } from 'react'
import { Menu, X, LayoutTemplate, BarChart2, Gift, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function HamburgerMenu({ onExport }) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  function handleNavigate(path) {
    navigate(path)
    setIsOpen(false)
  }

  const menuItems = [
    { path: '/templates', label: 'Templates', icon: LayoutTemplate },
    { path: '/study-analysis', label: 'Study Analysis', icon: BarChart2 },
    { path: '/rewards', label: 'Rewards', icon: Gift },
  ]

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} style={{
        background: isOpen ? 'var(--surface-2)' : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '36px', height: '36px', borderRadius: '10px',
      }}>
        {isOpen
          ? <X size={20} color='var(--primary)' />
          : <Menu size={20} color='var(--muted-fg)' />
        }
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'fixed', top: '58px', right: '16px',
            background: 'var(--surface)', borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 100, minWidth: '200px',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {menuItems.map((item, idx) => {
              const Icon = item.icon
              return (
                <button key={item.path} onClick={() => handleNavigate(item.path)} style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '12px', padding: '14px 16px', border: 'none',
                  background: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: '14px',
                  fontWeight: '600', color: 'var(--fg)',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'left',
                }}>
                  <Icon size={18} color='var(--primary)' />
                  {item.label}
                </button>
              )
            })}
            <button onClick={() => { onExport?.(); setIsOpen(false) }} style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: '12px', padding: '14px 16px', border: 'none',
              background: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '14px',
              fontWeight: '600', color: 'var(--fg)', textAlign: 'left',
            }}>
              <Download size={18} color='var(--primary)' />
              Export Data
            </button>
          </div>
        </>
      )}
    </>
  )
}