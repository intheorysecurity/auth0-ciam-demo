import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@auth0/nextjs-auth0'
import HomeClient from '@/components/HomeClient'
import { getOrgNameFromHostname } from '@/lib/host'

type ConnectionOption = {
  id: string
  name: string
  displayName: string
}

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

    // Fetch enabled connections
    const connectionsResponse = await fetch(
      `https://${auth0Domain}/api/v2/organizations/${org.id}/enabled_connections`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    let enabledConnections: any[] = []
    if (connectionsResponse.ok) {
      enabledConnections = await connectionsResponse.json()
    }

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
      connections: enabledConnections.map((conn: any) => ({
        id: conn.connection_id,
        name: conn.connection?.name || conn.connection_id,
        displayName: conn.connection?.display_name || conn.connection?.name || conn.connection_id,
      })),
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

async function getDefaultClientConnections(): Promise<ConnectionOption[] | null> {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  if (!auth0Domain || !clientId) return null

  try {
    const managementApiToken = await getManagementApiToken()

    // Fetch all connections (include enabled_clients so we can filter by this app's client_id).
    // If enabled_clients is not present/usable, we fall back to per-connection client lookup:
    // https://auth0.com/docs/api/management/v2/connections/get-connection-clients
    const resp = await fetch(
      `https://${auth0Domain}/api/v2/connections?per_page=100&include_totals=false&include_fields=true&fields=id,name,display_name,enabled_clients`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!resp.ok) return null
    const connections: any[] = await resp.json()

    const hasEnabledClientsField = connections.some((c) => Array.isArray(c?.enabled_clients))
    if (hasEnabledClientsField) {
      return connections
        .filter((c) => Array.isArray(c.enabled_clients) && c.enabled_clients.includes(clientId))
        .map((c) => ({
          id: c.id,
          name: c.name,
          displayName: c.display_name || c.name,
        }))
    }

    // Fallback: check enabled clients for each connection (more expensive).
    const results: ConnectionOption[] = []
    for (const c of connections) {
      if (!c?.id || !c?.name) continue
      const clientsResp = await fetch(
        `https://${auth0Domain}/api/v2/connections/${encodeURIComponent(c.id)}/clients`,
        {
          headers: {
            Authorization: `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      )
      if (!clientsResp.ok) continue
      const clients: any[] = await clientsResp.json()
      const enabled = clients.some((cl) => cl?.client_id === clientId)
      if (enabled) {
        results.push({
          id: c.id,
          name: c.name,
          displayName: c.display_name || c.name,
        })
      }
    }

    return results
  } catch {
    return null
  }
}

export default async function Home() {
  // Get hostname from request headers first (needed for redirects)
  const headersList = await headers()
  const hostname = headersList.get('host') || headersList.get('x-forwarded-host') || 'localhost'
  const protocol = headersList.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  const baseUrl = `${protocol}://${hostname}`
  
  // Check if user is logged in
  const session = await getSession()
  if (session?.user) {
    // Redirect to profile on the same subdomain to preserve branding
    redirect(`${baseUrl}/profile`)
  }
  
  // Extract organization name from hostname (supports localhost + ngrok patterns)
  const orgName: string | null = getOrgNameFromHostname(hostname)
  let orgBranding: any = null
  let defaultConnections: ConnectionOption[] | null = null
  
  if (orgName) {
    orgBranding = await getOrganizationBranding(orgName)
  } else {
    // Root (no org subdomain): show only connections enabled for this client/application.
    defaultConnections = await getDefaultClientConnections()
  }

  return <HomeClient orgName={orgName} orgBranding={orgBranding} defaultConnections={defaultConnections} />
}
