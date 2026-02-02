'use client'

import { useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import AppNav from '@/components/AppNav'

interface HomeClientProps {
  orgName: string | null
  orgBranding: any
  defaultConnections?: Array<{ id: string; name: string; displayName: string }> | null
  isAuthenticated?: boolean
  userName?: string | null
}

export default function HomeClient({
  orgName,
  orgBranding,
  defaultConnections,
  isAuthenticated = false,
  userName,
}: HomeClientProps) {
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

  return (
    <>
      {brandingStyles && (
        <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />
      )}
    <div className="welcome-container">
      {/* Login Bar */}
      <AppNav
        logoUrl={orgBranding?.branding?.logo || null}
        logoAlt={orgBranding?.displayName || orgBranding?.name || 'CIAM Platform'}
        title={orgBranding?.displayName || orgBranding?.name || 'CIAM Platform'}
        orgName={orgName}
        isAuthenticated={isAuthenticated}
        showHome
        showProfile
        showAuth
      />

      {/* Welcome Hero Section */}
      <div className="welcome-hero">
        <div className="welcome-content">
          <h1 className="welcome-title">
            Enterprise-Grade Identity & Access Management
          </h1>
          <p className="welcome-subtitle">
            Secure, scalable, and user-friendly authentication platform built for modern applications. 
            Manage user identities, enable multi-factor authentication, and streamline access control.
          </p>
          
          <div className="welcome-features">
            <div className="feature-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Enterprise Security Standards</span>
            </div>
            <div className="feature-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Multi-Factor Authentication</span>
            </div>
            <div className="feature-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Lightning-Fast Performance</span>
            </div>
            <div className="feature-item">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <span>Customizable Branding</span>
            </div>
          </div>
        </div>

        {/* Right-side panel */}
        {isAuthenticated ? (
          <div className="login-panel">
            <div className="login-panel-header">
              <h2 className="login-panel-title">Welcome back</h2>
              <p className="login-panel-subtitle" style={{ marginTop: '0.25rem' }}>
                {userName ? (
                  <>
                    Signed in as <strong>{userName}</strong>.
                  </>
                ) : (
                  'You are signed in.'
                )}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href="/profile"
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 1rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--primary-color, #2f242c)',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 800,
                }}
              >
                Go to profile
              </a>
              <a
                href="/courses"
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 1rem',
                  borderRadius: 10,
                  border: '1px solid #e0e0e0',
                  background: 'white',
                  color: '#2f242c',
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                View courses
              </a>
            </div>

          </div>
        ) : (
          <LoginPage orgName={orgName} orgBranding={orgBranding} defaultConnections={defaultConnections} />
        )}
      </div>
    </div>
    </>
  )
}
