import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'
import { isValidCourseId } from '@/lib/courses'

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

export async function POST(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const courseId = typeof body?.courseId === 'string' ? body.courseId.trim() : ''
  if (!courseId) {
    return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
  }
  if (!isValidCourseId(courseId)) {
    return NextResponse.json({ error: 'Unknown courseId' }, { status: 400 })
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  if (!auth0Domain) {
    return NextResponse.json({ error: 'Missing AUTH0_DOMAIN' }, { status: 500 })
  }

  try {
    const userId = session.user.sub
    const managementApiToken = await getManagementApiToken()

    // Fetch current user_metadata so we can remove the course safely.
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
    const existing = Array.isArray(userMetadata.enrolled_courses) ? userMetadata.enrolled_courses : []
    const enrolled = existing.filter((id: any) => typeof id === 'string' && id !== courseId)

    const patchResp = await fetch(`https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_metadata: {
          ...userMetadata,
          enrolled_courses: enrolled,
        },
      }),
      cache: 'no-store',
    })

    if (!patchResp.ok) {
      const errorText = await patchResp.text().catch(() => '')
      return NextResponse.json({ error: 'Failed to unenroll from course', details: errorText }, { status: patchResp.status })
    }

    return NextResponse.json({ ok: true, courseId, enrolled_courses: enrolled })
  } catch (error: any) {
    console.error('Course unenrollment failed:', error)
    return NextResponse.json({ error: 'Failed to unenroll from course', details: error?.message }, { status: 500 })
  }
}

