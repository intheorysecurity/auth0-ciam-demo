import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request as any)
    
    if (!session || !session.user) {
      return NextResponse.redirect(new URL('/api/auth/login', request.url))
    }

    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    if (!code || !state) {
      return NextResponse.redirect(new URL('/profile?error=missing_params', request.url))
    }

    // Parse state to get linking information
    let linkState: any = {}
    try {
      linkState = JSON.parse(decodeURIComponent(state))
    } catch {
      return NextResponse.redirect(new URL('/profile?error=invalid_state', request.url))
    }

    if (linkState.action !== 'link') {
      return NextResponse.redirect(new URL('/profile?error=invalid_action', request.url))
    }

    // Exchange code for token to get the new identity
    const auth0Domain = process.env.AUTH0_DOMAIN
    const clientId = process.env.AUTH0_CLIENT_ID
    const clientSecret = process.env.AUTH0_CLIENT_SECRET
    // Use dynamic base URL from request to include subdomain if present
    // This must match the redirect_uri used in the authorization request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const redirectUri = `${baseUrl}/api/auth/link-callback`

    const tokenResponse = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      let errorDetails = 'Unknown error'
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error_description || errorJson.error || errorText
      } catch {
        errorDetails = errorText || 'Failed to exchange authorization code'
      }
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(new URL(`/profile?error=token_exchange_failed&details=${encodeURIComponent(errorDetails)}`, request.url))
    }

    const tokens = await tokenResponse.json()
    
    // Get user info from the new identity
    const userInfoResponse = await fetch(`https://${auth0Domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text()
      let errorDetails = 'Failed to retrieve user information'
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error_description || errorJson.error || errorText
      } catch {
        errorDetails = errorText || 'Unknown error'
      }
      console.error('UserInfo failed:', errorText)
      return NextResponse.redirect(new URL(`/profile?error=userinfo_failed&details=${encodeURIComponent(errorDetails)}`, request.url))
    }

    const userInfo = await userInfoResponse.json()
    console.log('UserInfo received:', { sub: userInfo.sub, email: userInfo.email })
    
    // Link the account using Management API
    const managementApiToken = await getManagementApiToken()
    const userId = session.user.sub
    const newIdentity = userInfo.sub // This is the new identity's user_id (e.g., "google-oauth2|123456")

    // Extract connection and provider user ID from the identity
    if (!newIdentity || !newIdentity.includes('|')) {
      console.error('Invalid identity format:', newIdentity, 'Full userInfo:', userInfo)
      return NextResponse.redirect(new URL(`/profile?error=invalid_identity&details=${encodeURIComponent(`Identity format: ${newIdentity}`)}`, request.url))
    }

    const [connection, providerUserId] = newIdentity.split('|')
    console.log('Linking account:', { userId, connection, providerUserId })

    // Link the account using Management API
    // Note: The connection name should match the Auth0 connection name (e.g., "google-oauth2", not "google")
    const linkResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}/identities`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: connection,
          user_id: providerUserId,
        }),
      }
    )

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text()
      let error: any = {}
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { message: errorText }
      }
      
      // Extract detailed error message
      let errorDetails = error.message || error.error || errorText || 'Unknown error'
      
      // Add more context for common errors
      if (error.message?.includes('already exists')) {
        errorDetails = 'This account is already linked to another user or is already linked to your account.'
      } else if (error.message?.includes('access_denied')) {
        errorDetails = 'Access denied. Please ensure the social connection is properly configured in Auth0.'
      } else if (error.message?.includes('invalid_grant')) {
        errorDetails = 'Invalid authorization code. The code may have expired. Please try linking again.'
      }
      
      console.error('Account linking error:', error)
      console.error('Linking details:', { userId, connection, providerUserId, errorCode: error.code, errorMessage: error.message })
      return NextResponse.redirect(new URL(`/profile?error=link_failed&details=${encodeURIComponent(errorDetails)}`, request.url))
    }

    // Success - redirect to profile
    return NextResponse.redirect(new URL('/profile?linked=success', request.url))
  } catch (error: any) {
    console.error('Link callback error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return NextResponse.redirect(new URL(`/profile?error=callback_error&details=${encodeURIComponent(error.message || 'Unknown error')}`, request.url))
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

