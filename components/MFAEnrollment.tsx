'use client'

import { useState, useEffect } from 'react'

interface MFAEnrollmentProps {
  userId: string
  emailVerified?: boolean
}

interface MFAFactor {
  id: string
  name: string
  type: 'totp' | 'sms' | 'email' | 'push-notification'
  enrolled: boolean
}

const MFA_FACTORS: MFAFactor[] = [
  { id: 'push-notification', name: 'Auth0 Guardian', type: 'push-notification', enrolled: false },
  { id: 'totp', name: 'Authenticator App (TOTP)', type: 'totp', enrolled: false },
  { id: 'sms', name: 'SMS', type: 'sms', enrolled: false },
  { id: 'email', name: 'Email', type: 'email', enrolled: false },
]

export default function MFAEnrollment({ userId, emailVerified = false }: MFAEnrollmentProps) {
  const [factors, setFactors] = useState<MFAFactor[]>(MFA_FACTORS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [enrollingFactor, setEnrollingFactor] = useState<string | null>(null)

  useEffect(() => {
    fetchMFAStatus()
  }, [userId])

  const fetchMFAStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/user/mfa`)
      if (response.ok) {
        const data = await response.json()
        // Update factors with enrollment status
        const updatedFactors = MFA_FACTORS.map((factor) => ({
          ...factor,
          enrolled: data.enrolledFactors?.includes(factor.id) || false,
        }))
        setFactors(updatedFactors)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error || 'Failed to fetch MFA status')
        // Still set factors even on error so they display
        setFactors(MFA_FACTORS)
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching MFA status')
      // Still set factors even on error so they display
      setFactors(MFA_FACTORS)
    } finally {
      setLoading(false)
    }
  }

  const enrollFactor = async (factorId: string) => {
    // Check if email is verified before allowing MFA enrollment
    if (!emailVerified) {
      setError('Please verify your email address before enabling MFA. Check your email for a verification link.')
      return
    }

    try {
      setError('')
      setSuccess('')
      setEnrollingFactor(factorId)

      const response = await fetch('/api/user/mfa/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ factor: factorId }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Auth0 returns a ticket_url - open in new window/tab
        if (data.ticket_url) {
          // Open Auth0's enrollment page in a new window/tab
          window.open(data.ticket_url, '_blank', 'noopener,noreferrer')
          setEnrollingFactor(null)
          setSuccess('Enrollment page opened in a new tab. The page will automatically update when enrollment is complete.')
        } else {
          setError('No enrollment ticket received from Auth0')
          setEnrollingFactor(null)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to enroll MFA factor')
        setEnrollingFactor(null)
      }
    } catch (err: any) {
      setError(err.message || 'Error enrolling MFA factor')
      setEnrollingFactor(null)
    }
  }

  // Note: Verification is now handled by Auth0's enrollment page
  // Users are redirected to Auth0's enrollment page where they complete the enrollment

  const unenrollFactor = async (factorId: string) => {
    try {
      setError('')
      setSuccess('')

      const response = await fetch('/api/user/mfa/unenroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ factor: factorId }),
      })

      if (response.ok) {
        setSuccess('MFA factor unenrolled successfully!')
        fetchMFAStatus()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to unenroll MFA factor')
      }
    } catch (err: any) {
      setError(err.message || 'Error unenrolling MFA factor')
    }
  }

  const enrolledFactors = factors.filter(f => f.enrolled)
  const availableFactors = factors.filter(f => !f.enrolled)

  if (loading) {
    return (
      <div className="profile-section">
        <h2>Multi-Factor Authentication</h2>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="profile-section">
      <h2>Multi-Factor Authentication</h2>
      {!emailVerified && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          color: '#856404'
        }}>
          <strong>⚠️ Email Verification Required:</strong> You must verify your email address before you can enable Multi-Factor Authentication. Please check your email for a verification link or use the "Send Verification Email" button in your profile.
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Enrolled Factors Section */}
      {enrolledFactors.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Enrolled Factors
          </h3>
          {enrolledFactors.map((factor) => (
            <div 
              key={factor.id} 
              className="mfa-factor enrolled"
              style={{ 
                background: 'var(--bg-secondary)', 
                border: '2px solid var(--primary-color)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--primary-color)' }}>{factor.name}</strong>
                  <div className="status" style={{ 
                    display: 'inline-block', 
                    marginLeft: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    background: 'var(--primary-color)',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    ✓ Enrolled
                  </div>
                </div>
                <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => unenrollFactor(factor.id)}
                    style={{ minWidth: '100px' }}
                  >
                    Unenroll
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Factors Section - Always show factors */}
      {(availableFactors.length > 0 || factors.length === 0) ? (
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            {enrolledFactors.length > 0 ? 'Available Factors' : 'MFA Factors'}
          </h3>
          {availableFactors.map((factor) => (
            <div 
              key={factor.id} 
              className="mfa-factor"
              style={{ 
                background: 'var(--bg-secondary)', 
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <strong>{factor.name}</strong>
                  <div style={{ 
                    display: 'inline-block', 
                    marginLeft: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    fontSize: '0.75rem'
                  }}>
                    Not enrolled
                  </div>
                </div>
                <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => enrollFactor(factor.id)}
                    disabled={enrollingFactor !== null || !emailVerified}
                    style={{ 
                      minWidth: '100px',
                      opacity: !emailVerified ? 0.5 : 1,
                      cursor: !emailVerified ? 'not-allowed' : 'pointer'
                    }}
                    title={!emailVerified ? 'Email verification required' : ''}
                  >
                    Enroll
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : factors.length === 0 ? (
        // Fallback: Show all MFA_FACTORS if factors state is empty
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            MFA Factors
          </h3>
          {MFA_FACTORS.map((factor) => (
            <div 
              key={factor.id} 
              className="mfa-factor"
              style={{ 
                background: 'var(--bg-secondary)', 
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <strong>{factor.name}</strong>
                  <div style={{ 
                    display: 'inline-block', 
                    marginLeft: '0.75rem',
                    padding: '0.25rem 0.75rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    fontSize: '0.75rem'
                  }}>
                    Not enrolled
                  </div>
                </div>
                <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => enrollFactor(factor.id)}
                    disabled={enrollingFactor !== null || !emailVerified}
                    style={{ 
                      minWidth: '100px',
                      opacity: !emailVerified ? 0.5 : 1,
                      cursor: !emailVerified ? 'not-allowed' : 'pointer'
                    }}
                    title={!emailVerified ? 'Email verification required' : ''}
                  >
                    Enroll
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {enrollingFactor && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Redirecting to Auth0's enrollment page...
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            If you are not redirected automatically, please check your browser settings.
          </p>
        </div>
      )}
    </div>
  )
}

