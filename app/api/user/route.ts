import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const userId = session.user.sub
  const managementApiToken = await getManagementApiToken()
  const auth0Domain = process.env.AUTH0_DOMAIN

  try {
    // Fetch full user details from Management API
    const response = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      // Fallback to session user if Management API fails
      return NextResponse.json(session.user)
    }

    const user = await response.json()

    // Extract user metadata for preferences
    const userMetadata = user.user_metadata || {}
    
    // Get phone_number from standard field or metadata (fallback)
    const phoneNumber = user.phone_number || userMetadata.phone_number || null
    
    // Format response with all relevant fields
    return NextResponse.json({
      // Basic info from session
      sub: user.user_id || session.user.sub,
      email: user.email || session.user.email,
      name: user.name || session.user.name,
      nickname: user.nickname || session.user.nickname,
      picture: user.picture || session.user.picture,
      email_verified: user.email_verified || false,
      
      // Additional profile fields
      phone_number: phoneNumber,
      phone_number_verified: user.phone_number_verified || false,
      given_name: user.given_name || null,
      family_name: user.family_name || null,
      
      // Auth0-specific fields
      created_at: user.created_at || null,
      updated_at: user.updated_at || null,
      last_login: user.last_login || null,
      last_ip: user.last_ip || null,
      logins_count: user.logins_count || 0,
      
      // User metadata (preferences, timezone, etc.)
      timezone: userMetadata.timezone || null,
      preferences: userMetadata.preferences || {},
      
      // Organization info (if available)
      org_id: user.org_id || null,
      org_name: user.org_name || null,
    })
  } catch (error) {
    console.error('Error fetching user details:', error)
    // Fallback to session user
    return NextResponse.json(session.user)
  }
}

