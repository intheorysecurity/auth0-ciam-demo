import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

type OrgMember = {
  user_id: string
  name?: string
  email?: string
  picture?: string
}

type OrgRole = {
  id: string
  name: string
  description?: string
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

  if (!response.ok) {
    throw new Error('Failed to get management API token')
  }

  const data = await response.json()
  return data.access_token
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = idx++
      if (current >= items.length) return
      results[current] = await fn(items[current], current)
    }
  })

  await Promise.all(workers)
  return results
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orgName: string } }
) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  if (!auth0Domain) {
    return NextResponse.json({ error: 'Missing AUTH0_DOMAIN' }, { status: 500 })
  }

  try {
    const managementApiToken = await getManagementApiToken()

    // Resolve org by name
    const orgResp = await fetch(
      `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(params.orgName)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!orgResp.ok) {
      const errorText = await orgResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Organization not found', details: errorText },
        { status: orgResp.status }
      )
    }

    const org = await orgResp.json()
    const orgId = org?.id
    if (!orgId) {
      return NextResponse.json({ error: 'Organization response missing id' }, { status: 500 })
    }

    // Fetch members
    // API: GET /api/v2/organizations/{id}/members
    // Reference: https://auth0.com/docs/api/management/v2/organizations/get-organization-members
    const membersResp = await fetch(
      `https://${auth0Domain}/api/v2/organizations/${encodeURIComponent(orgId)}/members?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!membersResp.ok) {
      const errorText = await membersResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to fetch organization members', details: errorText },
        { status: membersResp.status }
      )
    }

    const membersData = await membersResp.json()
    const members: OrgMember[] = Array.isArray(membersData)
      ? membersData
      : (membersData?.members as OrgMember[]) || []

    // Fetch each member's org roles
    // API: GET /api/v2/organizations/{id}/members/{user_id}/roles
    // Reference: https://auth0.com/docs/manage-users/organizations/configure-organizations/retrieve-member-roles
    const membersWithRoles = await mapWithConcurrency(members, 10, async (m) => {
      if (!m?.user_id) {
        return { ...m, roles: [] as OrgRole[] }
      }

      const rolesResp = await fetch(
        `https://${auth0Domain}/api/v2/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(
          m.user_id
        )}/roles?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      )

      if (!rolesResp.ok) {
        return { ...m, roles: [] as OrgRole[] }
      }

      const rolesData = await rolesResp.json()
      const roles: OrgRole[] = Array.isArray(rolesData)
        ? rolesData
        : (rolesData?.roles as OrgRole[]) || []

      return { ...m, roles }
    })

    return NextResponse.json({
      orgId,
      members: membersWithRoles.map((m) => ({
        user_id: m.user_id,
        name: m.name || null,
        email: (m as any).email || null,
        picture: m.picture || null,
        roles: Array.isArray((m as any).roles) ? (m as any).roles : [],
      })),
    })
  } catch (error: any) {
    console.error('Error fetching organization members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization members', details: error?.message },
      { status: 500 }
    )
  }
}

