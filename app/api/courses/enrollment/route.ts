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

export async function GET(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  if (!auth0Domain) {
    return NextResponse.json({ error: 'Missing AUTH0_DOMAIN' }, { status: 500 })
  }

  try {
    const userId = session.user.sub
    const managementApiToken = await getManagementApiToken()

    const userResp = await fetch(`https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!userResp.ok) {
      const errorText = await userResp.text().catch(() => '')
      return NextResponse.json({ error: 'Failed to fetch user', details: errorText }, { status: userResp.status })
    }

    const user = await userResp.json()
    const userMetadata = user?.user_metadata || {}
    const enrolled = Array.isArray(userMetadata.enrolled_courses) ? userMetadata.enrolled_courses : []

    return NextResponse.json(
      { ok: true, enrolled_courses: enrolled },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: any) {
    console.error('Failed to load course enrollment:', error)
    return NextResponse.json({ error: 'Failed to load enrollment', details: error?.message }, { status: 500 })
  }
}

