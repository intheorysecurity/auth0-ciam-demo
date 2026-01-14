'use client'

import { useState, useEffect } from 'react'

interface AccountLinkingProps {
  userId: string
}

interface SocialAccount {
  connection: string
  user_id: string
  provider: string
  isSocial: boolean
  email?: string | null
  picture?: string | null
  name?: string | null
}

const SOCIAL_CONNECTIONS = [
  { id: 'google-oauth2', displayName: 'Google', provider: 'google' },
  { id: 'facebook', displayName: 'Facebook', provider: 'facebook' },
  { id: 'twitter', displayName: 'X (Twitter)', provider: 'twitter' },
]

export default function AccountLinking({ userId }: AccountLinkingProps) {
  const [linkedAccounts, setLinkedAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [errorDetails, setErrorDetails] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchLinkedAccounts()
    
    // Check for success/error messages from URL
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('linked') === 'success') {
      setSuccess('Account linked successfully!')
      setError('')
      setErrorDetails('')
      fetchLinkedAccounts() // Refresh the linked accounts list
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (urlParams.get('error')) {
      const errorType = urlParams.get('error')
      const details = urlParams.get('details') || ''
      
      // Map error types to user-friendly messages
      const errorMessages: Record<string, string> = {
        'missing_params': 'Missing required parameters. Please try linking again.',
        'invalid_state': 'Invalid authentication state. Please try linking again.',
        'invalid_action': 'Invalid action. Please try linking again.',
        'token_exchange_failed': 'Failed to exchange authorization code for token.',
        'userinfo_failed': 'Failed to retrieve user information from the social provider.',
        'invalid_identity': 'Invalid identity format received from the provider.',
        'link_failed': 'Failed to link the account. The account may already be linked or there was an issue with the linking process.',
        'callback_error': 'An error occurred during the account linking process.',
      }
      
      const errorMessage = errorMessages[errorType || ''] || 'Failed to link account. Please try again.'
      setError(errorMessage)
      setErrorDetails(details)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [userId])

  const fetchLinkedAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/user/accounts`)
      if (response.ok) {
        const data = await response.json()
        console.log('Linked accounts data:', data)
        // Log picture URLs for debugging
        data.forEach((account: SocialAccount) => {
          if (account.picture) {
            console.log(`Picture URL for ${account.connection}:`, account.picture)
          }
        })
        setLinkedAccounts(data)
      } else {
        setError('Failed to fetch linked accounts')
        setErrorDetails('Unable to retrieve your linked accounts. Please refresh the page.')
      }
    } catch (err: any) {
      setError('Error fetching linked accounts')
      setErrorDetails(err.message || 'An unexpected error occurred while fetching your linked accounts')
    } finally {
      setLoading(false)
    }
  }

  const linkAccount = async (connectionId: string) => {
    try {
      setError('')
      setSuccess('')
      
      const response = await fetch('/api/auth/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connection: connectionId }),
      })

      if (response.ok) {
        const data = await response.json()
        // Redirect to Auth0 for linking
        if (data.url) {
          window.location.href = data.url
        } else {
          setSuccess('Account linked successfully!')
          fetchLinkedAccounts()
        }
      } else {
        const errorData = await response.json()
        const errorMsg = errorData.error || 'Failed to link account'
        setError(errorMsg)
        setErrorDetails(errorData.details || '')
      }
    } catch (err: any) {
      setError('Error linking account')
      setErrorDetails(err.message || 'An unexpected error occurred')
    }
  }

  const unlinkAccount = async (connection: string, providerUserId: string) => {
    try {
      setError('')
      setSuccess('')
      
      const response = await fetch('/api/user/unlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection,
          user_id: providerUserId,
        }),
      })

      if (response.ok) {
        setSuccess('Account unlinked successfully!')
        fetchLinkedAccounts()
      } else {
        const errorData = await response.json()
        const errorMsg = errorData.error || 'Failed to unlink account'
        setError(errorMsg)
        setErrorDetails(errorData.details || '')
      }
    } catch (err: any) {
      setError('Error unlinking account')
      setErrorDetails(err.message || 'An unexpected error occurred')
    }
  }

  const isAccountLinked = (connectionId: string) => {
    return linkedAccounts.some(
      (account) => account.connection === connectionId || account.provider === connectionId
    )
  }

  const getLinkedAccount = (connectionId: string) => {
    return linkedAccounts.find(
      (account) => account.connection === connectionId || account.provider === connectionId
    )
  }

  if (loading) {
    return (
      <div className="profile-section">
        <h2>Linked Accounts</h2>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="profile-section">
      <h2>Linked Accounts</h2>
      {error && (
        <div className="error">
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{error}</div>
          {errorDetails && (
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.25rem' }}>
              <strong>Details:</strong> {errorDetails}
            </div>
          )}
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
            If this issue persists, please check:
            <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
              <li>The callback URL is added to Auth0's allowed callback URLs</li>
              <li>The social connection is properly configured in Auth0</li>
              <li>You're not trying to link an account that's already linked</li>
            </ul>
          </div>
        </div>
      )}
      {success && <div className="success">{success}</div>}

      {SOCIAL_CONNECTIONS.map((social) => {
        const isLinked = isAccountLinked(social.id)
        const linkedAccount = getLinkedAccount(social.id)

        return (
          <div
            key={social.id}
            className={`social-account ${isLinked ? 'connected' : ''}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: '1rem',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              marginBottom: '0.75rem',
              border: isLinked ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              {isLinked && linkedAccount?.picture && (
                <img 
                  src={linkedAccount.picture} 
                  alt={linkedAccount.name || social.displayName}
                  onError={(e) => {
                    // Log error for debugging
                    console.error('Image failed to load:', linkedAccount.picture)
                    console.error('Error event:', e)
                    // Hide the broken image
                    e.currentTarget.style.display = 'none'
                  }}
                  onLoad={() => {
                    console.log('Image loaded successfully:', linkedAccount.picture)
                  }}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid var(--primary-color)',
                    display: 'block'
                  }}
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <strong>{social.displayName}</strong>
                {isLinked && linkedAccount && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {linkedAccount.email && (
                      <div>{linkedAccount.email}</div>
                    )}
                    {linkedAccount.name && linkedAccount.name !== linkedAccount.email && (
                      <div style={{ opacity: 0.8 }}>{linkedAccount.name}</div>
                    )}
                    {!linkedAccount.email && !linkedAccount.name && (
                      <div className="status" style={{ 
                        display: 'inline-block',
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: 'var(--primary-color)',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        ✓ Connected
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
              {isLinked && linkedAccount ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => unlinkAccount(linkedAccount.connection, linkedAccount.user_id)}
                  style={{ minWidth: '100px' }}
                >
                  Unlink
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => linkAccount(social.id)}
                  style={{ minWidth: '100px' }}
                >
                  Link Account
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

