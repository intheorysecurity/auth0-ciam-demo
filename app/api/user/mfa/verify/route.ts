import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'

export async function POST(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { factor, code, secret } = await request.json()
  const userId = session.user.sub
  const managementApiToken = await getManagementApiToken()

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    if (factor === 'totp') {
      // Verify TOTP code
      if (!secret) {
        return NextResponse.json(
          { error: 'Secret required for TOTP verification' },
          { status: 400 }
        )
      }

      const isValid = authenticator.verify({ token: code, secret })
      
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        )
      }

      // Update user metadata to mark TOTP as enrolled
      const updateResponse = await fetch(
        `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_metadata: {
              mfa_enrolled: {
                totp: true,
                totp_secret: secret, // In production, encrypt this
              },
            },
          }),
        }
      )

      if (!updateResponse.ok) {
        throw new Error('Failed to update user MFA status')
      }

      return NextResponse.json({ success: true })
    } else if (factor === 'sms' || factor === 'email') {
      // For SMS/Email, verify the code
      // In production, this would verify against Auth0's MFA service
      // For now, we'll update user metadata
      const updateResponse = await fetch(
        `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${managementApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_metadata: {
              mfa_enrolled: {
                [factor]: true,
              },
            },
          }),
        }
      )

      if (!updateResponse.ok) {
        throw new Error('Failed to update user MFA status')
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Invalid MFA factor' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error verifying MFA enrollment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify MFA enrollment' },
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

