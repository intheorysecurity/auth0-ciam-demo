import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

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

async function resolveOrgIdByName(orgName: string, auth0Domain: string, managementApiToken: string) {
  const orgResp = await fetch(
    `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(orgName)}`,
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
    return { ok: false as const, status: orgResp.status, errorText }
  }

  const org = await orgResp.json()
  const orgId = org?.id
  if (!orgId) {
    return { ok: false as const, status: 500, errorText: 'Organization response missing id' }
  }

  return { ok: true as const, orgId }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgName: string }> }
) {
  const { orgName } = await context.params
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
    const orgLookup = await resolveOrgIdByName(orgName, auth0Domain, managementApiToken)
    if (!orgLookup.ok) {
      return NextResponse.json(
        { error: 'Organization not found', details: orgLookup.errorText },
        { status: orgLookup.status }
      )
    }

    // API: GET /api/v2/organizations/{id}/invitations
    // Reference: https://auth0.com/docs/api/management/v2/organizations/get-invitations
    const invResp = await fetch(
      `https://${auth0Domain}/api/v2/organizations/${encodeURIComponent(orgLookup.orgId)}/invitations?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!invResp.ok) {
      const errorText = await invResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to fetch invitations', details: errorText },
        { status: invResp.status }
      )
    }

    const data = await invResp.json()
    const invitations = Array.isArray(data) ? data : data?.invitations || []

    return NextResponse.json({
      orgId: orgLookup.orgId,
      invitations,
    })
  } catch (error: any) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations', details: error?.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgName: string }> }
) {
  const { orgName } = await context.params
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  if (!auth0Domain) {
    return NextResponse.json({ error: 'Missing AUTH0_DOMAIN' }, { status: 500 })
  }
  if (!clientId) {
    return NextResponse.json({ error: 'Missing AUTH0_CLIENT_ID' }, { status: 500 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const inviterName = typeof body?.inviterName === 'string' ? body.inviterName.trim() : ''
  const connectionId = typeof body?.connectionId === 'string' ? body.connectionId.trim() : ''
  const sendInvitationEmail =
    typeof body?.sendInvitationEmail === 'boolean' ? body.sendInvitationEmail : true
  const ttlSec = typeof body?.ttlSec === 'number' && body.ttlSec >= 0 ? body.ttlSec : undefined
  const roles = Array.isArray(body?.roles) ? body.roles.filter((r: any) => typeof r === 'string') : []

  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  }

  try {
    const managementApiToken = await getManagementApiToken()
    const orgLookup = await resolveOrgIdByName(orgName, auth0Domain, managementApiToken)
    if (!orgLookup.ok) {
      return NextResponse.json(
        { error: 'Organization not found', details: orgLookup.errorText },
        { status: orgLookup.status }
      )
    }

    // Reference payload: https://auth0.com/docs/manage-users/organizations/configure-organizations/send-membership-invitations
    // Some tenants enforce inviter as required; always include it (default from session).
    const defaultInviterName =
      inviterName ||
      (typeof (session.user as any)?.name === 'string' ? (session.user as any).name : '') ||
      (typeof (session.user as any)?.email === 'string' ? (session.user as any).email : '') ||
      (typeof (session.user as any)?.sub === 'string' ? (session.user as any).sub : '') ||
      'Admin'

    const payload: any = {
      inviter: { name: defaultInviterName },
      invitee: { email },
      client_id: clientId,
      send_invitation_email: sendInvitationEmail,
    }

    if (connectionId) payload.connection_id = connectionId
    if (typeof ttlSec === 'number') payload.ttl_sec = ttlSec
    if (roles.length > 0) payload.roles = roles

    const createResp = await fetch(
      `https://${auth0Domain}/api/v2/organizations/${encodeURIComponent(orgLookup.orgId)}/invitations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    )

    if (!createResp.ok) {
      const errorText = await createResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to create invitation', details: errorText },
        { status: createResp.status }
      )
    }

    const created = await createResp.json()
    return NextResponse.json(created)
  } catch (error: any) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation', details: error?.message },
      { status: 500 }
    )
  }
}

