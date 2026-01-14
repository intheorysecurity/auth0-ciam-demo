'use client'

import { useEffect } from 'react'
import LoginPage from '@/components/LoginPage'

interface HomeClientProps {
  orgName: string | null
  orgBranding: any
}

export default function HomeClient({ orgName, orgBranding }: HomeClientProps) {
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
            <a href="#features">Features</a>
            <a href="#security">Security</a>
            <a href="#support">Support</a>
          </nav>
        </div>
      </div>

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

        {/* Login Panel */}
        <LoginPage orgName={orgName} orgBranding={orgBranding} />
      </div>
    </div>
    </>
  )
}
