import { headers } from 'next/headers'
import { getSession } from '@auth0/nextjs-auth0'
import HomeClient from '@/components/HomeClient'
import { getOrgNameCandidatesFromHostname } from '@/lib/host'

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

    // Fetch all connections.
    // NOTE (Auth0 Jan 2026): enabled_clients is deprecated/absent for many tenants in GET /api/v2/connections.
    // We therefore do NOT rely on enabled_clients and instead filter using:
    // GET /api/v2/connections/{id}/clients (Get enabled clients for a connection).
    const resp = await fetch(
      `https://${auth0Domain}/api/v2/connections?per_page=100&include_totals=false&include_fields=true&fields=id,name,display_name`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!resp.ok) return null
    const raw = await resp.json().catch(() => null)
    const connections: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.connections)
        ? (raw as any).connections
        : []

    if (!Array.isArray(connections) || connections.length === 0) {
      return []
    }

    const connectionHasClient = (clientsRaw: any): boolean => {
      const list: any[] = Array.isArray(clientsRaw)
        ? clientsRaw
        : Array.isArray(clientsRaw?.clients)
          ? clientsRaw.clients
          : []

      return list.some((cl) => {
        // Some tenants return a list of client_id strings.
        if (typeof cl === 'string') return cl === clientId
        // Others return objects like { client_id, name }.
        if (!cl || typeof cl !== 'object') return false
        return cl.client_id === clientId || cl.clientId === clientId || cl.id === clientId
      })
    }

    // Filter enabled connections for this application (per-connection lookup; more expensive but reliable).
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
      const clientsRaw = await clientsResp.json().catch(() => null)
      const enabled = connectionHasClient(clientsRaw)
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
  
  // Check if user is logged in
  const session = await getSession()
  const isAuthenticated = !!session?.user
  const userName =
    (session?.user && typeof (session.user as any).name === 'string' ? (session.user as any).name : '') ||
    (session?.user && typeof (session.user as any).nickname === 'string' ? (session.user as any).nickname : '') ||
    (session?.user && typeof (session.user as any).email === 'string' ? (session.user as any).email : '') ||
    null
  
  // Resolve organization from hostname (generic: try candidates and pick the first org that exists in Auth0)
  const orgNameCandidates = getOrgNameCandidatesFromHostname(hostname)
  let orgBranding: any = null
  let defaultConnections: ConnectionOption[] | null = null
  
  let orgName: string | null = null
  for (const candidate of orgNameCandidates) {
    const branding = await getOrganizationBranding(candidate)
    if (branding) {
      orgName = candidate
      orgBranding = branding
      break
    }
  }

  if (!orgName) {
    // Root (no org subdomain): show only connections enabled for this client/application.
    defaultConnections = await getDefaultClientConnections()
  }

  return (
    <HomeClient
      orgName={orgName}
      orgBranding={orgBranding}
      defaultConnections={defaultConnections}
      isAuthenticated={isAuthenticated}
      userName={userName}
    />
  )
}
