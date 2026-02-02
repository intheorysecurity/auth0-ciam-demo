import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@auth0/nextjs-auth0'
import AppNav from '@/components/AppNav'
import CoursesClient from '@/components/CoursesClient'
import { COURSES } from '@/lib/courses'
import { getOrgNameCandidatesFromHostname } from '@/lib/host'

async function getManagementApiToken(): Promise<string> {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MANAGEMENT_API_CLIENT_ID
  const clientSecret = process.env.AUTH0_MANAGEMENT_API_CLIENT_SECRET

  const response = await fetch(`https://${auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${auth0Domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get management API token')
  }

  const data = await response.json()
  return data.access_token
}

async function getOrganizationBranding(orgName: string) {
  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    const managementApiToken = await getManagementApiToken()
    const response = await fetch(
      `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(orgName)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) return null
    const org = await response.json()
    const branding = org.branding || {}

    return {
      id: org.id,
      name: org.name,
      displayName: org.display_name,
      branding: {
        logo: branding.logo_url || null,
        primaryColor: branding.colors?.primary || '#2f242c',
        secondaryColor: branding.colors?.page_background || branding.colors?.secondary || '#d5d3d5',
      },
    }
  } catch {
    return null
  }
}

export default async function CoursesPage() {
  const headersList = await headers()
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost'

  // Resolve org branding (if on an org host/subdomain)
  const orgNameCandidates = getOrgNameCandidatesFromHostname(hostname)
  let orgBranding: any = null
  let orgName: string | null = null
  for (const candidate of orgNameCandidates) {
    const branding = await getOrganizationBranding(candidate)
    if (branding) {
      orgName = candidate
      orgBranding = branding
      break
    }
  }

  const brandingStyles = orgBranding?.branding
    ? `
      :root {
        ${orgBranding.branding.primaryColor ? `--primary-color: ${orgBranding.branding.primaryColor};` : ''}
        ${orgBranding.branding.secondaryColor ? `--secondary-color: ${orgBranding.branding.secondaryColor};` : ''}
        ${orgBranding.branding.secondaryColor ? `--bg-secondary: ${orgBranding.branding.secondaryColor};` : ''}
      }
    `
    : ''

  const session = await getSession()
  const isAuthenticated = !!session?.user

  // Demo progressive profiling:
  // If an authenticated user is missing required profile info, bounce them back through Auth0.
  // This adds `pp=1` to the /authorize request (handled by the Post-Login Action) and returns
  // them back to /courses afterwards.
  if (isAuthenticated) {
    const givenName =
      session?.user && typeof (session.user as any).given_name === 'string'
        ? ((session.user as any).given_name as string).trim()
        : ''
    const familyName =
      session?.user && typeof (session.user as any).family_name === 'string'
        ? ((session.user as any).family_name as string).trim()
        : ''

    if (!givenName || !familyName) {
      redirect('/api/auth/login?pp=1&returnTo=/courses')
    }
  }

  return (
    <>
      {brandingStyles && <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />}

      <div className="welcome-container">
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

        <div style={{ maxWidth: 980, margin: '3rem auto', padding: '0 1.5rem' }}>
          <div
            style={{
              padding: '1.75rem',
              background: 'white',
              borderRadius: 16,
              border: '1px solid #e0e0e0',
            }}
          >
            <h1 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--primary-color, #2f242c)' }}>
              Courses
            </h1>
            <p style={{ margin: 0, color: '#6b6b6b' }}>
              Browse what’s available. You can view courses while logged out, but you must sign in to enroll.
            </p>

            <CoursesClient
              courses={COURSES}
              isAuthenticated={isAuthenticated}
              organizationId={orgBranding?.id || null}
            />
          </div>
        </div>
      </div>
    </>
  )
}

