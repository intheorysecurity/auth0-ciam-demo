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
  const managementApiToken = await getManagementApiToken()

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    // Map our internal factor IDs to Auth0 factor types
    // Auth0 supports: push-notification, phone, email, otp, webauthn-roaming, webauthn-platform
    const factorMap: Record<string, string> = {
      'push-notification': 'push-notification',  // Auth0 Guardian -> push-notification
      'totp': 'otp',      // TOTP -> otp
      'sms': 'phone',     // SMS -> phone
      'email': 'email',   // Email -> email
    }

    const auth0Factor = factorMap[factor]
    if (!auth0Factor) {
      return NextResponse.json(
        { error: 'Invalid MFA factor. Supported factors: push-notification, totp, sms, email' },
        { status: 400 }
      )
    }

    // Create enrollment ticket using Auth0's MFA API
    // Reference: https://auth0.com/docs/secure/multi-factor-authentication/multi-factor-authentication-developer-resources/create-custom-enrollment-tickets
    // Endpoint: POST /api/v2/guardian/enrollments/ticket
    const ticketResponse = await fetch(
      `https://${auth0Domain}/api/v2/guardian/enrollments/ticket`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: session.user.sub,
          factor: auth0Factor,
          allow_multiple_enrollments: true, // Allow user to enroll multiple factors
        }),
      }
    )

    if (!ticketResponse.ok) {
      const errorText = await ticketResponse.text()
      let error: any = {}
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { message: errorText }
      }
      console.error('Failed to create enrollment ticket:', error)
      return NextResponse.json(
        { error: error.message || error.error || 'Failed to create enrollment ticket' },
        { status: ticketResponse.status }
      )
    }

    const ticketData = await ticketResponse.json()
    
    // Return the ticket URL - user will be redirected to Auth0's enrollment page
    return NextResponse.json({
      ticket_id: ticketData.ticket_id,
      ticket_url: ticketData.ticket_url,
      factor: auth0Factor,
    })
  } catch (error: any) {
    console.error('Error enrolling MFA factor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enroll MFA factor' },
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

