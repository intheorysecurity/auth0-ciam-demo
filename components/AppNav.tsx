'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0/client'

type AppNavProps = {
  logoUrl?: string | null
  logoAlt?: string
  title?: string
  orgName?: string | null
  isAuthenticated?: boolean
  showHome?: boolean
  showCourses?: boolean
  showProfile?: boolean
  showAuth?: boolean
}

export default function AppNav({
  logoUrl,
  logoAlt,
  title,
  orgName,
  isAuthenticated,
  showHome = true,
  showCourses = true,
  showProfile = true,
  showAuth = true,
}: AppNavProps) {
  const { user, isLoading } = useUser()
  const authed = typeof isAuthenticated === 'boolean' ? isAuthenticated : !!user

  return (
    <div className="login-bar">
      <div className="login-bar-content">
        <div className="login-bar-logo">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={logoAlt || title || 'Logo'}
              style={{ maxHeight: '40px', maxWidth: '200px', objectFit: 'contain' }}
            />
          ) : (
            title || 'CIAM Platform'
          )}
        </div>
        <nav className="login-bar-nav">
          {showHome ? <Link href="/">Home</Link> : null}
          {showCourses ? <Link href="/courses">Courses</Link> : null}
          {showProfile ? <Link href="/profile">Profile</Link> : null}
          {orgName ? <Link href={`/organizations/${encodeURIComponent(orgName)}`}>Organization</Link> : null}
          {showAuth ? (
            authed ? (
              <a href="/api/auth/logout">Logout</a>
            ) : (
              // During auth state hydration, avoid flicker by hiding auth link until we know.
              // If server provided isAuthenticated, this renders deterministically.
              isLoading && typeof isAuthenticated !== 'boolean' ? null : <a href="/api/auth/login">Login</a>
            )
          ) : null}
        </nav>
      </div>
    </div>
  )
}

