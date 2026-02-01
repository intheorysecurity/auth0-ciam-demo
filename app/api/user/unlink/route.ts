import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { connection, user_id } = await request.json()
  const userId = session.user.sub
  const managementApiToken = await getManagementApiToken()

  try {
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    // Step 1: Unlink account using Management API
    const unlinkResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}/identities/${connection}/${user_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!unlinkResponse.ok) {
      const error = await unlinkResponse.json().catch(() => ({ message: 'Failed to unlink account' }))
      throw new Error(error.message || 'Failed to unlink account')
    }

    // Step 2: Delete the linked account's user record from Auth0
    // Construct the full Auth0 user ID: connection|user_id (e.g., "twitter|123456")
    const linkedAccountUserId = `${connection}|${user_id}`
    
    const deleteUserResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(linkedAccountUserId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Note: If the user doesn't exist (404), that's okay - it might have already been deleted
    // or might not exist as a separate user account
    if (!deleteUserResponse.ok && deleteUserResponse.status !== 404) {
      const errorText = await deleteUserResponse.text()
      console.warn(`Failed to delete linked account user ${linkedAccountUserId}:`, errorText)
      // Don't throw error here - unlinking succeeded, deletion is secondary
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error unlinking account:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unlink account' },
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

