import { headers } from 'next/headers'
import Link from 'next/link'
import { getOrgNameCandidatesFromHostname } from '@/lib/host'
import AppNav from '@/components/AppNav'

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

  if (!response.ok) throw new Error('Failed to get management API token')
  const data = await response.json()
  return data.access_token
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string; error_description?: string }
}) {
  const headersList = await headers()
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost'
  const protocol = headersList.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  const baseUrl = `${protocol}://${hostname}`

  const error = searchParams?.error || 'unknown_error'
  const errorDescription = searchParams?.error_description || ''

  // Extract org name from subdomain (if present) so we can show branding/logo.
  let orgBranding: any = null

  const orgNameCandidates = getOrgNameCandidatesFromHostname(hostname)
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

  return (
    <>
      {brandingStyles && <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />}

      <div className="welcome-container">
        <AppNav
          logoUrl={orgBranding?.branding?.logo || null}
          logoAlt={orgBranding?.displayName || orgBranding?.name || 'CIAM Platform'}
          title={orgBranding?.displayName || orgBranding?.name || 'CIAM Platform'}
          orgName={orgName}
          showHome
          showProfile
          showAuth
        />

        <div style={{ maxWidth: 860, margin: '3rem auto', padding: '0 1.5rem' }}>
          <div
            style={{
              padding: '1.75rem',
              background: '#f8f9fa',
              borderRadius: 16,
              border: '1px solid #e0e0e0',
            }}
          >
            <h1 style={{ margin: 0, marginBottom: '0.5rem', color: '#2f242c' }}>
              We couldn’t complete your login
            </h1>
            <p style={{ margin: 0, color: '#6b6b6b' }}>
              An error occurred during authentication. Details are below.
            </p>

            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#2f242c', fontWeight: 700, marginBottom: 6 }}>
                Error
              </div>
              <div
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '0.9rem',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 10,
                  padding: '0.75rem 0.9rem',
                  color: '#2f242c',
                  overflowX: 'auto',
                }}
              >
                {error}
              </div>
            </div>

            {errorDescription && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#2f242c', fontWeight: 700, marginBottom: 6 }}>
                  Description
                </div>
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: 10,
                    padding: '0.75rem 0.9rem',
                    color: '#2f242c',
                  }}
                >
                  {errorDescription}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 1rem',
                  borderRadius: 10,
                  border: '1px solid #e0e0e0',
                  background: 'white',
                  color: '#2f242c',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Back to home
              </Link>

              <a
                href={`${baseUrl}/api/auth/login${orgBranding?.id ? `?organization=${encodeURIComponent(orgBranding.id)}` : ''}`}
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 1rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--primary-color, #2f242c)',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Try login again
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

