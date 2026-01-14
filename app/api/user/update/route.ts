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

export async function PATCH(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const userId = session.user.sub
    const managementApiToken = await getManagementApiToken()
    const auth0Domain = process.env.AUTH0_DOMAIN

    // First, get current user to check connection type and preserve metadata
    const currentUserResponse = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let currentUser: any = null
    let existingMetadata: any = {}
    if (currentUserResponse.ok) {
      currentUser = await currentUserResponse.json()
      existingMetadata = currentUser.user_metadata || {}
    }

    // Build update payload - separate standard fields from user_metadata
    const updatePayload: any = {}
    const userMetadata: any = { ...existingMetadata }

    // Standard user fields that can be updated
    if (body.name !== undefined) updatePayload.name = body.name
    if (body.nickname !== undefined) updatePayload.nickname = body.nickname
    if (body.given_name !== undefined) updatePayload.given_name = body.given_name
    if (body.family_name !== undefined) updatePayload.family_name = body.family_name
    if (body.picture !== undefined) updatePayload.picture = body.picture

    // Handle phone_number - always store in user_metadata to avoid conflicts
    // Auth0 only supports phone_number in standard field for specific database connections
    // To avoid errors, we'll always use user_metadata
    let phoneNumberUpdateMethod: 'standard' | 'metadata' = 'metadata'
    if (body.phone_number !== undefined) {
      // Always store phone_number in user_metadata to avoid operation_not_supported errors
      userMetadata.phone_number = body.phone_number
      // Remove phone_number from existing metadata if it was there before (cleanup)
      // This ensures we don't have duplicates
    } else if (existingMetadata.phone_number) {
      // If phone_number is being cleared (empty/null), remove it from metadata
      delete userMetadata.phone_number
    }

    // User metadata fields (preferences, timezone, etc.)
    if (body.timezone !== undefined) userMetadata.timezone = body.timezone
    if (body.preferences !== undefined) userMetadata.preferences = body.preferences

    // Add user_metadata to update payload
    if (Object.keys(userMetadata).length > 0) {
      updatePayload.user_metadata = userMetadata
    }

    // Update user via Management API
    let response = await fetch(
      `https://${auth0Domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    )

    // Handle any errors from the update
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update user:', errorText)
      return NextResponse.json(
        { error: 'Failed to update user profile', details: errorText },
        { status: response.status }
      )
    }

    const updatedUser = await response.json()

    // Get phone_number from standard field or metadata
    const phoneNumber = updatedUser.phone_number || updatedUser.user_metadata?.phone_number || null
    const updatedUserMetadata = updatedUser.user_metadata || {}

    return NextResponse.json({
      success: true,
      user: {
        sub: updatedUser.user_id,
        email: updatedUser.email,
        name: updatedUser.name,
        nickname: updatedUser.nickname,
        picture: updatedUser.picture,
        email_verified: updatedUser.email_verified || false,
        
        // Additional profile fields
        phone_number: phoneNumber,
        phone_number_verified: updatedUser.phone_number_verified || false,
        given_name: updatedUser.given_name || null,
        family_name: updatedUser.family_name || null,
        
        // Auth0-specific fields
        created_at: updatedUser.created_at || null,
        updated_at: updatedUser.updated_at || null,
        last_login: updatedUser.last_login || null,
        last_ip: updatedUser.last_ip || null,
        logins_count: updatedUser.logins_count || 0,
        
        // User metadata (preferences, timezone, etc.)
        timezone: updatedUserMetadata.timezone || null,
        preferences: updatedUserMetadata.preferences || {},
        
        // Organization info (if available)
        org_id: updatedUser.org_id || null,
        org_name: updatedUser.org_name || null,
      },
    })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile', details: error.message },
      { status: 500 }
    )
  }
}
