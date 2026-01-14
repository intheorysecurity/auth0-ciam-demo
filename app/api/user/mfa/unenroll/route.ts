import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const session = await getSession(request as any)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { factor } = await request.json()
  const userId = session.user.sub
  const managementApiToken = await getManagementApiToken()

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    // Map our internal factor IDs to Auth0 factor types
    const factorMap: Record<string, string> = {
      'push-notification': 'push-notification',  // Auth0 Guardian -> push-notification
      'totp': 'totp',      // TOTP -> totp
      'sms': 'phone',      // SMS -> phone
      'email': 'email',    // Email -> email
    }
    
    const auth0Factor = factorMap[factor]
    if (!auth0Factor) {
      return NextResponse.json(
        { error: 'Invalid MFA factor' },
        { status: 400 }
      )
    }
    
    // First, get user's authentication methods to find the method ID
    // Reference: https://auth0.com/docs/api/management/v2/users/get-authentication-methods
    const methodsResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!methodsResponse.ok) {
      const errorText = await methodsResponse.text()
      throw new Error(`Failed to fetch authentication methods: ${errorText}`)
    }

    const authenticationMethods = await methodsResponse.json()
    
    // Find the authentication method for this factor type
    const method = Array.isArray(authenticationMethods)
      ? authenticationMethods.find((m: any) => 
          m.type?.toLowerCase() === auth0Factor && m.confirmed === true
        )
      : null

    if (!method || !method.id) {
      return NextResponse.json(
        { error: 'Authentication method not found for this factor' },
        { status: 404 }
      )
    }

    // Delete the authentication method using the correct endpoint
    // Reference: https://auth0.com/docs/api/management/v2/users/delete-authentication-methods-by-authentication-method-id
    // Endpoint: DELETE /api/v2/users/{id}/authentication-methods/{authentication_method_id}
    const deleteResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods/${method.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      throw new Error(`Failed to delete authentication method: ${errorText}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error unenrolling MFA factor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unenroll MFA factor' },
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

