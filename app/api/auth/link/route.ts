import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to get base URL from request (including subdomain)
function getBaseUrlFromRequest(request: NextRequest): string {
  try {
    const url = new URL(request.url)
    return `${url.protocol}//${url.host}`
  } catch {
    // Fallback to environment variable
    return process.env.AUTH0_BASE_URL || 'http://localhost:3000'
  }
}

export async function POST(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { connection } = await request.json()
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  // Use dynamic base URL from request to include subdomain if present
  const baseUrl = getBaseUrlFromRequest(request)

  // Generate account linking URL - use custom callback for linking
  // Include the current user's email as login_hint to help with account linking
  const loginHint = session.user.email || ''
  
  const linkUrl = `https://${auth0Domain}/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(`${baseUrl}/api/auth/link-callback`)}&` +
    `connection=${connection}&` +
    `prompt=consent&` +
    `scope=openid profile email&` +
    `${loginHint ? `login_hint=${encodeURIComponent(loginHint)}&` : ''}` +
    `state=${encodeURIComponent(JSON.stringify({ action: 'link', userId: session.user.sub }))}`

  console.log('Account linking URL generated for connection:', connection, 'with redirect_uri:', `${baseUrl}/api/auth/link-callback`)
  return NextResponse.json({ url: linkUrl })
}

