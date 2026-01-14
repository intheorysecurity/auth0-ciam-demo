import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  
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
    
    // Get user's identities (linked accounts)
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
      throw new Error('Failed to fetch user accounts')
    }

    const user = await response.json()
    
    // Extract linked accounts from user identities with profile data
    const linkedAccounts = (user.identities || []).map((identity: any) => {
      // Extract picture - try multiple possible fields
      let picture = identity.profileData?.picture || 
                   identity.profileData?.avatar_url || 
                   identity.profileData?.picture_url ||
                   null
      
      // Log for debugging
      if (picture) {
        console.log('Picture URL found for', identity.connection, ':', picture)
      } else {
        console.log('No picture found for', identity.connection, 'profileData keys:', Object.keys(identity.profileData || {}))
      }
      
      return {
        connection: identity.connection,
        user_id: identity.user_id,
        provider: identity.provider,
        isSocial: identity.isSocial || false,
        // Extract email and picture from profileData
        email: identity.profileData?.email || null,
        picture: picture,
        name: identity.profileData?.name || identity.profileData?.nickname || null,
      }
    })

    return NextResponse.json(linkedAccounts)
  } catch (error: any) {
    console.error('Error fetching linked accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch linked accounts' },
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

