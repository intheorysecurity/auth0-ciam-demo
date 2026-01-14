'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@auth0/nextjs-auth0/client'
import { useRouter } from 'next/navigation'
import AccountLinking from '@/components/AccountLinking'
import MFAEnrollment from '@/components/MFAEnrollment'

interface ProfileClientProps {
  orgBranding: any
  orgName: string | null
}

export default function ProfileClient({ orgBranding, orgName }: ProfileClientProps) {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSendingVerification, setIsSendingVerification] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    given_name: '',
    family_name: '',
    phone_number: '',
    email: '',
    timezone: '',
    preferences: {
      theme: 'light',
      notifications: true,
      language: 'en',
    },
  })

  // Apply branding colors immediately (before useEffect runs)
  const brandingStyles = orgBranding?.branding ? `
    :root {
      ${orgBranding.branding.primaryColor ? `--primary-color: ${orgBranding.branding.primaryColor};` : ''}
      ${orgBranding.branding.secondaryColor ? `--secondary-color: ${orgBranding.branding.secondaryColor};` : ''}
      ${orgBranding.branding.secondaryColor ? `--bg-secondary: ${orgBranding.branding.secondaryColor};` : ''}
    }
  ` : ''

  useEffect(() => {
    // Also apply via JavaScript as fallback
    if (orgBranding?.branding) {
      const root = document.documentElement
      if (orgBranding.branding.primaryColor) {
        root.style.setProperty('--primary-color', orgBranding.branding.primaryColor)
      }
      if (orgBranding.branding.secondaryColor) {
        root.style.setProperty('--secondary-color', orgBranding.branding.secondaryColor)
        root.style.setProperty('--bg-secondary', orgBranding.branding.secondaryColor)
      }
    }
  }, [orgBranding])

  useEffect(() => {
    if (!isLoading && !user) {
      // Use absolute URL to preserve subdomain
      const loginUrl = `${window.location.origin}/api/auth/login`
      router.push(loginUrl)
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (user) {
      fetchUserInfo()
    }
  }, [user])

  useEffect(() => {
    if (userInfo) {
      // Initialize form data when userInfo is loaded
      setFormData({
        name: userInfo.name || '',
        nickname: userInfo.nickname || '',
        given_name: userInfo.given_name || '',
        family_name: userInfo.family_name || '',
        phone_number: userInfo.phone_number || '',
        email: userInfo.email || '',
        timezone: userInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        preferences: userInfo.preferences || {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
      })
    }
  }, [userInfo])

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/user')
      if (response.ok) {
        const data = await response.json()
        setUserInfo(data)
      }
    } catch (error) {
      console.error('Error fetching user info:', error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      // Handle nested fields like preferences.theme
      const [parent, child] = field.split('.')
      setFormData(prev => {
        const parentValue = prev[parent as keyof typeof prev] as any
        return {
          ...prev,
          [parent]: {
            ...(parentValue || {}),
            [child]: value,
          },
        }
      })
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }))
    }
  }

  // Format phone number to E.164 format (+[country code][number], max 15 digits)
  const formatPhoneToE164 = (phone: string): string | null => {
    if (!phone || phone.trim() === '') {
      return null
    }

    // Remove all non-digit characters except leading +
    let cleaned = phone.trim()
    
    // If it already starts with +, keep it
    const hasPlus = cleaned.startsWith('+')
    if (hasPlus) {
      cleaned = '+' + cleaned.slice(1).replace(/\D/g, '')
    } else {
      // Remove all non-digits
      cleaned = cleaned.replace(/\D/g, '')
      // If no + and starts with 1 (US), add +
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = '+' + cleaned
      } else if (cleaned.length === 10) {
        // Assume US number (10 digits), add +1
        cleaned = '+1' + cleaned
      } else {
        // For other formats, try to add + if it looks like a number
        cleaned = '+' + cleaned
      }
    }

    // Validate E.164 format: + followed by 1-15 digits
    const e164Pattern = /^\+[1-9]\d{1,14}$/
    if (e164Pattern.test(cleaned)) {
      return cleaned
    }

    return null
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Format phone number to E.164 before sending
      const dataToSend: any = { ...formData }
      if (dataToSend.phone_number && dataToSend.phone_number.trim() !== '') {
        const formattedPhone = formatPhoneToE164(dataToSend.phone_number)
        if (formattedPhone === null) {
          setSaveMessage({ 
            type: 'error', 
            text: 'Invalid phone number format. Please use E.164 format (e.g., +15551234567)' 
          })
          setIsSaving(false)
          return
        }
        dataToSend.phone_number = formattedPhone
      } else if (dataToSend.phone_number === '') {
        // Allow empty string to clear phone number
        dataToSend.phone_number = null
      }

      const response = await fetch('/api/user/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        const result = await response.json()
        setUserInfo(result.user)
        setIsEditing(false)
        setSaveMessage({ type: 'success', text: 'Profile updated successfully!' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        const error = await response.json()
        setSaveMessage({ type: 'error', text: error.error || 'Failed to update profile' })
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setSaveMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendVerificationEmail = async () => {
    setIsSendingVerification(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/user/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setSaveMessage({ 
          type: 'success', 
          text: 'Verification email sent! Please check your inbox and click the verification link.' 
        })
        setTimeout(() => setSaveMessage(null), 5000)
      } else {
        const error = await response.json()
        setSaveMessage({ 
          type: 'error', 
          text: error.error || 'Failed to send verification email' 
        })
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error)
      setSaveMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send verification email' 
      })
    } finally {
      setIsSendingVerification(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  // Get common timezones
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'UTC',
  ]

  if (isLoading) {
    return (
      <>
        {brandingStyles && (
          <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />
        )}
        <div className="profile-container">
          <div className="profile-card">
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
          </div>
        </div>
      </>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      {brandingStyles && (
        <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />
      )}
      <div className="profile-container">
        {/* Profile Header Bar */}
        <div className="login-bar">
          <div className="login-bar-content">
            <div className="login-bar-logo">
              {orgBranding?.branding?.logo ? (
                <img 
                  src={orgBranding.branding.logo} 
                  alt={orgBranding.displayName || orgBranding.name || 'Organization Logo'} 
                  style={{ 
                    maxHeight: '40px', 
                    maxWidth: '200px',
                    objectFit: 'contain'
                  }}
                />
              ) : (
                orgBranding?.displayName || orgBranding?.name || 'CIAM Platform'
              )}
            </div>
            <nav className="login-bar-nav">
              <a href="/profile">Profile</a>
              <a href="/api/auth/logout">Logout</a>
            </nav>
          </div>
        </div>

        <div className="profile-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: 0 }}>
              User Profile
            </h1>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn"
                style={{ 
                  background: 'var(--primary-color)', 
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1.5rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Edit Profile
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    // Reset form data to original values
                    if (userInfo) {
                      setFormData({
                        name: userInfo.name || '',
                        nickname: userInfo.nickname || '',
                        given_name: userInfo.given_name || '',
                        family_name: userInfo.family_name || '',
                        phone_number: userInfo.phone_number || '',
                        email: userInfo.email || '',
                        timezone: userInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        preferences: userInfo.preferences || {
                          theme: 'light',
                          notifications: true,
                          language: 'en',
                        },
                      })
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ 
                    background: 'var(--bg-secondary)', 
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn"
                  style={{ 
                    background: 'var(--primary-color)', 
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {saveMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                borderRadius: '6px',
                background: saveMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                color: saveMessage.type === 'success' ? '#155724' : '#721c24',
                border: `1px solid ${saveMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
              }}
            >
              {saveMessage.text}
            </div>
          )}

          {/* User Avatar */}
          {user.picture && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '2rem' 
            }}>
              <img 
                src={user.picture} 
                alt={user.name || 'User avatar'} 
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: '3px solid var(--primary-color)',
                  objectFit: 'cover',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              />
            </div>
          )}

          <div className="profile-section">
            <h2>Account Information</h2>
            
            <div className="form-group">
              <label>
                Email
                {userInfo?.email_verified ? (
                  <span style={{ color: 'var(--success-color)', fontSize: '0.875rem', marginLeft: '0.5rem', fontWeight: 600 }}>✓ Verified</span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>Not Verified</span>
                )}
              </label>
              <input
                type="email"
                value={isEditing ? formData.email : (userInfo?.email || user.email || '')}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={!isEditing}
                style={{
                  background: isEditing ? 'white' : 'var(--bg-secondary)',
                  cursor: isEditing ? 'text' : 'not-allowed',
                }}
              />
              {!userInfo?.email_verified && !isEditing && (
                <div style={{ marginTop: '0.5rem' }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (!isSendingVerification) {
                        handleSendVerificationEmail()
                      }
                    }}
                    style={{
                      color: 'var(--primary-color)',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      cursor: isSendingVerification ? 'not-allowed' : 'pointer',
                      opacity: isSendingVerification ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSendingVerification) {
                        e.currentTarget.style.textDecoration = 'underline'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none'
                    }}
                  >
                    {isSendingVerification ? 'Sending verification email...' : 'Send verification email'}
                  </a>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={isEditing ? formData.name : (userInfo?.name || user.name || '')}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isEditing}
                style={{
                  background: isEditing ? 'white' : 'var(--bg-secondary)',
                  cursor: isEditing ? 'text' : 'not-allowed',
                }}
              />
            </div>

            <div className="form-group">
              <label>Nickname</label>
              <input
                type="text"
                value={isEditing ? formData.nickname : (userInfo?.nickname || '')}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                disabled={!isEditing}
                style={{
                  background: isEditing ? 'white' : 'var(--bg-secondary)',
                  cursor: isEditing ? 'text' : 'not-allowed',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={isEditing ? formData.given_name : (userInfo?.given_name || '')}
                  onChange={(e) => handleInputChange('given_name', e.target.value)}
                  disabled={!isEditing}
                  style={{
                    background: isEditing ? 'white' : 'var(--bg-secondary)',
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={isEditing ? formData.family_name : (userInfo?.family_name || '')}
                  onChange={(e) => handleInputChange('family_name', e.target.value)}
                  disabled={!isEditing}
                  style={{
                    background: isEditing ? 'white' : 'var(--bg-secondary)',
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Phone Number
                {userInfo?.phone_number_verified && (
                  <span style={{ color: 'var(--success-color)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>✓ Verified</span>
                )}
              </label>
              <input
                type="tel"
                value={isEditing ? formData.phone_number : (userInfo?.phone_number || '')}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                disabled={!isEditing}
                placeholder="+15551234567"
                style={{
                  background: isEditing ? 'white' : 'var(--bg-secondary)',
                  cursor: isEditing ? 'text' : 'not-allowed',
                }}
              />
              {isEditing && (
                <small style={{ 
                  display: 'block', 
                  marginTop: '0.25rem', 
                  color: 'var(--text-secondary)', 
                  fontSize: '0.875rem' 
                }}>
                  Format: E.164 (e.g., +15551234567 or +441234567890). US numbers: enter 10 digits or include +1.
                </small>
              )}
            </div>

            {/* Organization - only show if subdomain is used */}
            {orgName && orgBranding && (
              <div className="form-group">
                <label>Organization</label>
                <input
                  type="text"
                  value={orgBranding.displayName || orgBranding.name || orgName}
                  disabled
                  style={{
                    background: 'var(--bg-secondary)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>
            )}

            <div className="form-group">
              <label>Last Login</label>
              <input
                type="text"
                value={formatDate(userInfo?.last_login)}
                disabled
                style={{
                  background: 'var(--bg-secondary)',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div className="form-group">
              <label>Account Created</label>
              <input
                type="text"
                value={formatDate(userInfo?.created_at)}
                disabled
                style={{
                  background: 'var(--bg-secondary)',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div className="form-group">
              <label>User ID</label>
              <input
                type="text"
                value={userInfo?.sub || user.sub || ''}
                disabled
                style={{
                  background: 'var(--bg-secondary)',
                  cursor: 'not-allowed',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          </div>

          {/* Preferences Section */}
          <div className="profile-section" style={{ marginTop: '2rem' }}>
            <h2>Preferences</h2>

            <div className="form-group">
              <label>Timezone</label>
              <select
                value={isEditing ? formData.timezone : (userInfo?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone)}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                disabled={!isEditing}
                style={{
                  background: isEditing ? 'white' : 'var(--bg-secondary)',
                  cursor: isEditing ? 'pointer' : 'not-allowed',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '1rem',
                }}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {isEditing && (
              <>
                <div className="form-group">
                  <label>Theme</label>
                  <select
                    value={formData.preferences.theme}
                    onChange={(e) => handleInputChange('preferences.theme', e.target.value)}
                    style={{
                      background: 'white',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={formData.preferences.notifications}
                      onChange={(e) => handleInputChange('preferences.notifications', e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    Enable Notifications
                  </label>
                </div>

                <div className="form-group">
                  <label>Language</label>
                  <select
                    value={formData.preferences.language}
                    onChange={(e) => handleInputChange('preferences.language', e.target.value)}
                    style={{
                      background: 'white',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
              </>
            )}

            {!isEditing && (
              <>
                <div className="form-group">
                  <label>Theme</label>
                  <input
                    type="text"
                    value={userInfo?.preferences?.theme || 'light'}
                    disabled
                    style={{
                      background: 'var(--bg-secondary)',
                      cursor: 'not-allowed',
                      textTransform: 'capitalize',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Notifications</label>
                  <input
                    type="text"
                    value={userInfo?.preferences?.notifications ? 'Enabled' : 'Disabled'}
                    disabled
                    style={{
                      background: 'var(--bg-secondary)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Language</label>
                  <input
                    type="text"
                    value={userInfo?.preferences?.language || 'en'}
                    disabled
                    style={{
                      background: 'var(--bg-secondary)',
                      cursor: 'not-allowed',
                      textTransform: 'uppercase',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <AccountLinking userId={user.sub || ''} />

          <MFAEnrollment userId={user.sub || ''} emailVerified={userInfo?.email_verified || false} />

          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
            <a href="/api/auth/logout" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Sign Out
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
