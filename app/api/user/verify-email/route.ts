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

export async function POST(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const userId = session.user.sub
    const managementApiToken = await getManagementApiToken()
    const auth0Domain = process.env.AUTH0_DOMAIN
    const clientId = process.env.AUTH0_CLIENT_ID

    // First, fetch user to get identity information
    const userResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Failed to fetch user:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user information', details: errorText },
        { status: userResponse.status }
      )
    }

    const user = await userResponse.json()
    
    // Get the primary identity (first identity, usually the one with the email)
    const primaryIdentity = user.identities?.[0]
    
    if (!primaryIdentity) {
      return NextResponse.json(
        { error: 'No identity found for user' },
        { status: 400 }
      )
    }

    // Build the request body
    const requestBody: any = {
      user_id: userId,
      client_id: clientId,
    }

    // Build identity block - fetch connection ID if needed
    const identity: any = {
      user_id: primaryIdentity.user_id,
      provider: primaryIdentity.provider === 'auth0' ? 'auth0' : primaryIdentity.provider,
    }

    // Check if connection is already in the correct format (con_xxxxxxxxxxxxxxxx)
    if (primaryIdentity.connection && /^con_[A-Za-z0-9]{16}$/.test(primaryIdentity.connection)) {
      identity.connection_id = primaryIdentity.connection
    } else if (primaryIdentity.connection) {
      // Try to fetch the connection ID from the connection name
      try {
        const connectionsResponse = await fetch(
          `https://${auth0Domain}/api/v2/connections?name=${encodeURIComponent(primaryIdentity.connection)}`,
          {
            headers: {
              Authorization: `Bearer ${managementApiToken}`,
              'Content-Type': 'application/json',
            },
          }
        )
        
        if (connectionsResponse.ok) {
          const connections = await connectionsResponse.json()
          const connection = Array.isArray(connections) 
            ? connections.find((c: any) => c.name === primaryIdentity.connection)
            : null
          
          if (connection && connection.id && /^con_[A-Za-z0-9]{16}$/.test(connection.id)) {
            identity.connection_id = connection.id
          }
        }
      } catch (err) {
        console.warn('Could not fetch connection ID:', err)
      }
    }

    // Only include identity block if we have connection_id (required field)
    if (identity.connection_id) {
      requestBody.identity = identity
    } else {
      // If we can't get connection_id, try without it (might work for auth0 provider)
      // But API requires it, so this might fail - but let's try
      requestBody.identity = identity
    }

    // Include organization_id if user is part of an organization
    if (user.org_id) {
      requestBody.organization_id = user.org_id
    }

    // Send verification email using Auth0 Management API
    // Reference: https://auth0.com/docs/api/management/v2/jobs/post-verification-email
    const response = await fetch(
      `https://${auth0Domain}/api/v2/jobs/verification-email`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to send verification email:', errorText)
      return NextResponse.json(
        { error: 'Failed to send verification email', details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
      jobId: result.id,
    })
  } catch (error: any) {
    console.error('Error sending verification email:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email', details: error.message },
      { status: 500 }
    )
  }
}
