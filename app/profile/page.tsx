import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@auth0/nextjs-auth0'
import ProfileClient from '@/components/ProfileClient'

async function getOrganizationBranding(orgName: string) {
  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    const managementApiToken = await getManagementApiToken()

    // Fetch organization by name
    const response = await fetch(
      `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(orgName)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always fetch fresh data
      }
    )

    if (!response.ok) {
      return null
    }

    const org = await response.json()

    // Extract branding from organization response
    const branding = org.branding || {}
    
    return {
      id: org.id,
      name: org.name,
      displayName: org.display_name,
      branding: {
        logo: branding.logo_url || null,
        icon: branding.logo_url || null,
        primaryColor: branding.colors?.primary || '#2f242c',
        secondaryColor: branding.colors?.page_background || branding.colors?.secondary || '#d5d3d5',
        colors: branding.colors || {},
      },
    }
  } catch (error) {
    console.error('Error fetching organization branding:', error)
    return null
  }
}

async function getManagementApiToken(): Promise<string> {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MANAGEMENT_API_CLIENT_ID
  const clientSecret = process.env.AUTH0_MANAGEMENT_API_CLIENT_SECRET

  const response = await fetch(`https://${auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

export default async function ProfilePage() {
  // Check if user is logged in
  const session = await getSession()
  if (!session?.user) {
    // Get hostname to preserve subdomain in redirect
    const headersList = await headers()
    const hostname = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost'
    const protocol = headersList.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
    const baseUrl = `${protocol}://${hostname}`

    // If we're on an org subdomain, include organization=<org_id> in the login redirect.
    // This ensures Auth0 receives the org context even when bypassing the home page login UI.
    let orgName: string | null = null
    let orgBranding: any = null
    const hostNoPort = hostname.split(':')[0]
    const parts = hostNoPort.split('.')
    if (parts.length > 2 || (parts.length === 2 && parts[0] !== 'localhost' && parts[0] !== '127')) {
      orgName = parts[0]
      orgBranding = await getOrganizationBranding(orgName)
    }

    if (orgBranding?.id) {
      redirect(`${baseUrl}/api/auth/login?organization=${encodeURIComponent(orgBranding.id)}`)
    }

    redirect(`${baseUrl}/api/auth/login`)
  }

  // Get hostname from request headers
  const headersList = await headers()
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost'
  
  // Extract organization name from subdomain
  let orgName: string | null = null
  let orgBranding: any = null
  
  const parts = hostname.split('.')
  if (parts.length > 2 || (parts.length === 2 && parts[0] !== 'localhost' && parts[0] !== '127')) {
    orgName = parts[0]
    orgBranding = await getOrganizationBranding(orgName)
  }

  return <ProfileClient orgBranding={orgBranding} orgName={orgName} />
}
