import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request as any)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const userId = session.user.sub
  const managementApiToken = await getManagementApiToken()

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    // Get user's authentication methods from Auth0 Management API
    // Reference: https://auth0.com/docs/api/management/v2/users/get-authentication-methods
    // Endpoint: GET /api/v2/users/{id}/authentication-methods
    const response = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Management API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch authentication methods from Management API', details: errorText },
        { status: response.status }
      )
    }

    const authenticationMethods = await response.json()
    
    // Extract enrolled factors from authentication methods array
    // The API returns an array directly: [{ id, type, confirmed, ... }]
    const enrolledFactors: string[] = []
    
    // Map Auth0 factor types to our internal IDs
    const auth0ToInternalMap: Record<string, string> = {
      'push-notification': 'push-notification',  // Auth0 'push-notification' -> our 'push-notification'
      'totp': 'totp',          // Auth0 'totp' -> our 'totp'
      'phone': 'sms',          // Auth0 'phone' -> our 'sms'
      'sms': 'sms',            // Auth0 'sms' -> our 'sms'
      'email': 'email',        // Auth0 'email' -> our 'email'
    }
    
    // Process authentication methods array
    if (Array.isArray(authenticationMethods)) {
      authenticationMethods.forEach((method: any) => {
        // Check if method is confirmed/enrolled
        if (method.confirmed === true && method.type) {
          const auth0FactorType = method.type.toLowerCase()
          const internalFactorId = auth0ToInternalMap[auth0FactorType]
          if (internalFactorId) {
            enrolledFactors.push(internalFactorId)
          }
        }
      })
    }

    return NextResponse.json({ enrolledFactors })
  } catch (error: any) {
    console.error('Error fetching MFA status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch MFA status' },
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


