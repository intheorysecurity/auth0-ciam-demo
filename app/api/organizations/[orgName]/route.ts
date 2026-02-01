import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgName: string }> }
) {
  const { orgName } = await context.params
  const auth0Domain = process.env.AUTH0_DOMAIN
  const managementApiToken = await getManagementApiToken()

  try {
    // Fetch organization by name using Auth0 Management API
    // Reference: https://auth0.com/docs/api/management/v2/organizations/get-name-by-name
    // Endpoint: GET /api/v2/organizations/name/{name}
    const response = await fetch(
      `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(orgName)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch organization' },
        { status: response.status }
      )
    }

    const org = await response.json()

    // Fetch enabled connections for this organization
    // Reference: https://auth0.com/docs/api/management/v2/organizations/get-enabled-connections
    // Endpoint: GET /api/v2/organizations/{id}/enabled_connections
    const connectionsResponse = await fetch(
      `https://${auth0Domain}/api/v2/organizations/${org.id}/enabled_connections`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let enabledConnections: any[] = []
    if (connectionsResponse.ok) {
      enabledConnections = await connectionsResponse.json()
    }

    // Extract branding from organization response
    // Branding is included in the organization object: branding.logo_url, branding.colors
    const branding = org.branding || {}
    
    return NextResponse.json({
      id: org.id,
      name: org.name,
      displayName: org.display_name,
      branding: {
        logo: branding.logo_url || null,
        icon: branding.logo_url || null, // Icon is typically the same as logo
        primaryColor: branding.colors?.primary || '#2f242c',
        secondaryColor: branding.colors?.page_background || branding.colors?.secondary || '#d5d3d5',
        colors: branding.colors || {},
      },
      connections: enabledConnections.map((conn: any) => ({
        id: conn.connection_id,
        name: conn.connection?.name || conn.connection_id,
        displayName: conn.connection?.display_name || conn.connection?.name || conn.connection_id,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
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

