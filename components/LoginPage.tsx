'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@auth0/nextjs-auth0/client'
import connectionsData from '@/connections.json'

interface LoginPageProps {
  orgName: string | null
  orgBranding: any
}

type ConnectionOption = {
  id: string
  displayName: string
  /**
   * Optional Auth0 connection name (used by /authorize `connection=`).
   * If omitted, we'll fall back to `id` and resolve server-side when possible.
   */
  name?: string
}

export default function LoginPage({ orgName, orgBranding }: LoginPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useUser()
  const [selectedConnection, setSelectedConnection] = useState<string>('') // UI selection (connection_id)
  const [selectedConnectionName, setSelectedConnectionName] = useState<string>('') // Auth0 connection name
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'select' | 'password' | 'code'>('select')
  const [error, setError] = useState('')

  // Legacy fallback: if anything still sends auth_error params to '/', surface it.
  // Primary behavior is now to route to /auth-error.
  useEffect(() => {
    const authError = searchParams.get('auth_error')
    if (!authError) return

    const authErrorDescription = searchParams.get('auth_error_description') || ''
    const message =
      authErrorDescription
        ? `Login failed: ${decodeURIComponent(authErrorDescription)}`
        : `Login failed: ${authError}`

    setError(message)
    setStep('select')

    // Clear the query params so refresh doesn't keep showing the error
    router.replace(window.location.pathname)
  }, [searchParams, router])

  // Use organization connections if available
  // If organization exists but has no connections, use empty array (will show message)
  // Only fall back to default connections if no organization is detected
  const connections: ConnectionOption[] = orgBranding
    ? (orgBranding.connections && orgBranding.connections.length > 0
        ? orgBranding.connections
        : []) // Organization exists but has no connections - show empty state
    : (connectionsData as ConnectionOption[]) // No organization - use default connections

  useEffect(() => {
    // Apply organization branding if available
    if (orgBranding?.branding) {
      const root = document.documentElement
      
      // Apply primary color
      if (orgBranding.branding.primaryColor) {
        root.style.setProperty('--primary-color', orgBranding.branding.primaryColor)
      }
      
      // Apply secondary color
      if (orgBranding.branding.secondaryColor) {
        root.style.setProperty('--secondary-color', orgBranding.branding.secondaryColor)
        // Also update bg-secondary if needed
        root.style.setProperty('--bg-secondary', orgBranding.branding.secondaryColor)
      }
    }
  }, [orgBranding])

  const handleConnectionSelect = (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId)
    setSelectedConnection(connectionId)
    setSelectedConnectionName(conn?.name || '')
    setError('')
    
    // Determine if it's passwordless or database connection.
    // Prefer connection name (works for org-enabled connections too), fall back to id heuristics.
    const connName = conn?.name || ''
    if (connName === 'email' || connName === 'sms') {
      setStep('code')
      return
    }

    if (connectionId.includes('passwordless') && (connectionId.includes('email') || connectionId.includes('sms'))) {
      setStep('code')
      return
    }

    setStep('password')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const resolvedConnectionName =
        selectedConnectionName || connections.find((c) => c.id === selectedConnection)?.name || ''

      if (!resolvedConnectionName) {
        setError('Please select an authentication method.')
        return
      }

      // Build login URL with query parameters
      const params = new URLSearchParams()
      // Auth0 /authorize expects connection *name*
      params.set('connection', resolvedConnectionName)
      
      // Add organization ID if detected (use org_id for Auth0)
      if (orgBranding?.id) {
        params.set('organization', orgBranding.id) // Auth0 expects organization ID, not name
      }

      // Handle different connection types
      if (resolvedConnectionName === 'email' || resolvedConnectionName === 'sms' || selectedConnection.includes('passwordless')) {
        if (step === 'code') {
          // For passwordless, we need to send code
          if ((resolvedConnectionName === 'email' || selectedConnection.includes('email')) && email) {
            params.set('login_hint', email)
          } else if ((resolvedConnectionName === 'sms' || selectedConnection.includes('sms')) && phoneNumber) {
            params.set('login_hint', phoneNumber)
          }
        }
      } else {
        // Database connection - username/password
        // Note: Password is handled by Auth0 Universal Login
        if (email) {
          params.set('login_hint', email)
        }
      }

      // Redirect to Auth0 login endpoint
      // Use absolute URL to preserve subdomain (e.g., org.localhost:3000)
      const loginUrl = `${window.location.origin}/api/auth/login?${params.toString()}`
      window.location.href = loginUrl
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="login-panel">
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="login-panel">
      <div className="login-panel-header">
        {(orgBranding?.branding?.logo || orgBranding?.branding?.icon) && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img 
              src={orgBranding.branding.logo || orgBranding.branding.icon} 
              alt={orgBranding.name || 'Organization Logo'} 
              style={{ maxHeight: '50px', maxWidth: '180px' }}
            />
          </div>
        )}
        <h2 className="login-panel-title">
          {orgBranding?.displayName || orgBranding?.name || 'Welcome Back'}
        </h2>
        <p className="login-panel-subtitle">
          Sign in to access your account
        </p>
      </div>

      {step === 'select' ? (
        <div>
          {connections.length === 0 ? (
            <div className="form-group">
              <div style={{ 
                padding: '1.5rem', 
                background: '#f8f9fa', 
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                textAlign: 'center'
              }}>
                <p style={{ 
                  color: '#2f242c', 
                  marginBottom: '0.5rem',
                  fontWeight: 600
                }}>
                  No authentication methods available
                </p>
                <p style={{ 
                  color: '#6b6b6b', 
                  fontSize: '0.875rem'
                }}>
                  This organization does not have any enabled connections. Please contact your administrator.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="connection">Select Authentication Method</label>
                <select
                  id="connection"
                  value={selectedConnection}
                  onChange={(e) => handleConnectionSelect(e.target.value)}
                >
                  <option value="">Choose a login method...</option>
                  {connections.map((conn: ConnectionOption) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ 
                textAlign: 'center', 
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color, #e0e0e0)'
              }}>
                <p style={{ 
                  color: 'var(--text-secondary, #6b6b6b)', 
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Don't have an account?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('screen_hint', 'signup')
                    
                    // Add organization ID if detected
                    if (orgBranding?.id) {
                      params.set('organization', orgBranding.id)
                    }
                    
                    // If a connection is selected, include it
                    const resolvedConnectionName =
                      selectedConnectionName || connections.find((c) => c.id === selectedConnection)?.name || ''
                    if (resolvedConnectionName) {
                      params.set('connection', resolvedConnectionName)
                    }
                    
                    // Use absolute URL to preserve subdomain (e.g., org.localhost:3000)
                    const signupUrl = `${window.location.origin}/api/auth/login?${params.toString()}`
                    window.location.href = signupUrl
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary-color, #2f242c)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Sign up here
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          {selectedConnection.includes('passwordless') && selectedConnection.includes('email') && (
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          )}

          {selectedConnection.includes('passwordless') && selectedConnection.includes('sms') && (
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                placeholder="+1 (555) 123-4567"
              />
            </div>
          )}

          {selectedConnection.includes('database') && (
            <>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>
            </>
          )}

          {error && <div className="error">{error}</div>}

          <div className="btn-group">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setStep('select')
                setSelectedConnection('')
                setSelectedConnectionName('')
                setError('')
              }}
            >
              Back
            </button>
            <button type="submit" className="btn">
              {selectedConnection.includes('passwordless') ? 'Send Code' : 'Sign In'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
