import { useState, useEffect } from 'react'
import { db } from '../db'

export default function CloudSync({ children }) {
  const [syncState, setSyncState] = useState('checking')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const currentUser = db.cloud.currentUser
      if (currentUser?.isLoggedIn) {
        setSyncState('synced')
      } else {
        setSyncState('login')
      }
    } catch {
      setSyncState('login')
    }
  }

  async function sendOTP() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await db.cloud.login({
        grant_type: 'otp',
        username: email.trim(),
      })
      setOtpSent(true)
    } catch (e) {
      setError('Failed to send OTP. Check email and try again.')
    }
    setLoading(false)
  }

  async function verifyOTP() {
    if (!otp.trim()) return
    setLoading(true)
    setError('')
    try {
      await db.cloud.login({
        grant_type: 'otp',
        username: email.trim(),
        otp: otp.trim(),
      })
      setSyncState('synced')
    } catch (e) {
      setError('Invalid OTP. Please try again.')
    }
    setLoading(false)
  }

  if (syncState === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'Nunito, sans-serif',
        background: '#f8fafc',
      }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  if (syncState === 'login') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'Nunito, sans-serif',
        background: '#f8fafc', padding: '20px',
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px', padding: '28px',
          width: '100%', maxWidth: '360px', border: '1px solid #e2e8f0',
        }}>
          {/* Logo */}
          <p style={{
            fontSize: '28px', fontWeight: '900', color: '#38bdf8',
            fontFamily: 'Nunito, sans-serif', textAlign: 'center',
            marginBottom: '6px',
          }}>KitnaHua</p>
          <p style={{
            fontSize: '13px', color: '#94a3b8', textAlign: 'center',
            marginBottom: '28px', fontWeight: '600',
          }}>
            Sign in to sync across devices
          </p>

          {!otpSent ? (
            <>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
                EMAIL ADDRESS
              </p>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '14px',
                  fontFamily: 'Nunito, sans-serif', outline: 'none',
                  color: '#0f172a', marginBottom: '16px', boxSizing: 'border-box',
                }}
              />
              {error && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', fontWeight: '600' }}>
                  {error}
                </p>
              )}
              <button
                onClick={sendOTP}
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: '12px',
                  border: 'none', background: loading ? '#94a3b8' : '#0f172a',
                  color: '#fff', fontSize: '14px', fontWeight: '800',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                }}
              >
                {loading ? 'Sending...' : 'Send OTP →'}
              </button>
            </>
          ) : (
            <>
              <div style={{
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: '10px', padding: '12px', marginBottom: '16px',
              }}>
                <p style={{ fontSize: '13px', color: '#15803d', fontWeight: '700' }}>
                  OTP sent to {email}
                </p>
              </div>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
                ENTER OTP
              </p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', fontSize: '18px',
                  fontFamily: 'Nunito, sans-serif', outline: 'none',
                  color: '#0f172a', marginBottom: '16px', boxSizing: 'border-box',
                  letterSpacing: '4px', textAlign: 'center',
                }}
              />
              {error && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px', fontWeight: '600' }}>
                  {error}
                </p>
              )}
              <button
                onClick={verifyOTP}
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: '12px',
                  border: 'none', background: loading ? '#94a3b8' : '#0f172a',
                  color: '#fff', fontSize: '14px', fontWeight: '800',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'Nunito, sans-serif', marginBottom: '12px',
                }}
              >
                {loading ? 'Verifying...' : 'Verify OTP →'}
              </button>
              <button
                onClick={() => { setOtpSent(false); setOtp(''); setError('') }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '12px',
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                  color: '#64748b', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                }}
              >
                Change email
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return children
}