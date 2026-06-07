import HamburgerMenu from './HamburgerMenu'

export default function TopBar({ totalPoints, onExport, onImport }) {

  function handleImportClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const success = await onImport(file)
      if (success) {
        alert('Data imported successfully!')
        window.location.reload()
      } else {
        alert('Import failed. Check file.')
      }
    }
    input.click()
  }

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
        <div style={{ background: 'rgba(56,189,248,0.15)', borderRadius: '20px', padding: '5px 12px', border: '1px solid rgba(56,189,248,0.3)' }}>
          <p style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', fontFamily: 'Nunito, sans-serif' }}>
            {totalPoints} 🏆
          </p>
        </div>
        <HamburgerMenu onExport={onExport} />
      </div>
    </div>
  )
}