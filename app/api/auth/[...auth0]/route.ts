import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0'
import { NextRequest } from 'next/server'

// Helper function to extract base URL from request (for use in callbacks)
function getBaseUrlFromRequest(req: any): string {
  // PRIORITY: Headers first (most reliable for subdomains)
  // nextUrl might be normalized and lose the subdomain
  if ('headers' in req) {
    const headers = req.headers
    // Handle both Headers object (App Router) and plain object (Pages Router)
    let host: string | null = null
    let protocol = 'http'
    
    if (headers instanceof Headers) {
      // App Router - Headers object
      host = headers.get('host') || headers.get('x-forwarded-host')
      const proto = headers.get('x-forwarded-proto')
      protocol = proto ? proto.split(',')[0].trim() : (headers.get('x-forwarded-port') === '443' ? 'https' : 'http')
    } else if (typeof headers === 'object' && headers !== null) {
      // Pages Router - plain object
      host = (headers.host as string) || (headers['x-forwarded-host'] as string) || null
      const proto = (headers['x-forwarded-proto'] as string)
      protocol = proto ? proto.split(',')[0].trim() : 'http'
    }
    
    if (host) {
      return `${protocol}://${host}`
    }
  }
  
  // Fallback: try nextUrl (but this might be normalized)
  if ('nextUrl' in req && req.nextUrl) {
    const nextUrl = req.nextUrl
    return `${nextUrl.protocol}//${nextUrl.host}`
  }
  
  // Fallback: try to construct from URL if available
  if ('url' in req && req.url) {
    try {
      // If URL is absolute, use it directly
      if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
        const url = new URL(req.url)
        return `${url.protocol}//${url.host}`
      }
      // If URL is relative, we need headers (already tried above)
    } catch {
      // URL parsing failed
    }
  }
  
  // Final fallback to environment variable
  console.warn('Could not determine base URL from request, using fallback:', process.env.AUTH0_BASE_URL || 'http://localhost:3000')
  return process.env.AUTH0_BASE_URL || 'http://localhost:3000'
}

// Custom login handler that:
// 1. Dynamically sets redirect URI based on request hostname (including subdomain)
// 2. Extracts organization and screen_hint from query params
// This ensures PKCE works correctly with subdomains
const loginHandler = handleLogin(async (req) => {
  // Get the base URL from the request (includes subdomain if present)
  const baseUrl = getBaseUrlFromRequest(req)
  const callbackUrl = `${baseUrl}/api/auth/callback`
  
  // Extract query parameters - handle both NextRequest (App Router) and NextApiRequest (Pages Router)
  let organization: string | null = null
  let screenHint: string | null = null
  let connection: string | null = null
  
  if ('url' in req && req.url) {
    // NextRequest (App Router) - use URL API
    try {
      const url = new URL(req.url)
      organization = url.searchParams.get('organization')
      screenHint = url.searchParams.get('screen_hint')
      connection = url.searchParams.get('connection')
    } catch {
      // URL parsing failed, skip
    }
  } else if ('query' in req && req.query) {
    // NextApiRequest (Pages Router) - use query object
    organization = (req.query.organization as string) || null
    screenHint = (req.query.screen_hint as string) || null
    connection = (req.query.connection as string) || null
  }
  
  // Build authorization params - include redirect_uri to ensure it matches the request hostname
  // This merges with the SDK's default params (including PKCE) rather than replacing them
  const customParams: Record<string, string> = {
    redirect_uri: callbackUrl,
  }
  
  if (organization) {
    customParams.organization = organization
  }
  
  if (screenHint) {
    customParams.screen_hint = screenHint
  }

  // If a specific connection was selected in the UI, pass it through to /authorize.
  // Auth0 expects the *connection name* here, but some UIs store connection IDs.
  // We resolve known placeholders and attempt id->name resolution via the Management API.
  if (connection) {
    const resolved = await resolveAuth0ConnectionName(connection)
    if (resolved) {
      customParams.connection = resolved
    }
  }
  
  return {
    authorizationParams: customParams,
  }
})

// Custom callback handler that uses dynamic redirect URI and preserves subdomain
const callbackHandler = handleCallback((req) => {
  const baseUrl = getBaseUrlFromRequest(req)
  const redirectUri = `${baseUrl}/api/auth/callback`
  
  // Set returnTo to preserve subdomain after authentication
  // Redirect to profile page on the same subdomain to maintain branding
  // This ensures users stay on org.localhost:3000 instead of being redirected to localhost:3000
  const returnTo = `${baseUrl}/profile`
  
  return {
    redirectUri,
    returnTo,
  }
})

// Create a wrapper that extracts hostname at route level
const authHandler = handleAuth({
  login: loginHandler,
  callback: callbackHandler,
})

// Export GET handler that wraps the auth handler
export async function GET(
  request: NextRequest,
  context: { params: { auth0: string[] } }
) {
  // Extract base URL from the actual NextRequest (this has the full hostname)
  // Use headers to get the actual hostname (including subdomain)
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 
                   (request.url.startsWith('https') ? 'https' : 'http')
  const baseUrl = `${protocol}://${host}`
  
  // Call the auth handler with both request and context
  return authHandler(request, context)
}

async function resolveAuth0ConnectionName(connectionParam: string): Promise<string | null> {
  const value = connectionParam.trim()
  if (!value) return null

  // Demo placeholders used in `connections.json`
  if (value === 'con_passwordless_email') return 'email'
  if (value === 'con_passwordless_sms') return 'sms'

  // If it's already a name (not an Auth0 connection_id), just pass it through
  // Auth0 connection_ids are typically like: con_[A-Za-z0-9]{16}
  if (!/^con_[A-Za-z0-9]{16}$/.test(value)) {
    return value
  }

  // Resolve connection id -> name via Management API
  const auth0Domain = process.env.AUTH0_DOMAIN
  if (!auth0Domain) return value

  try {
    const managementApiToken = await getManagementApiToken()
    const resp = await fetch(`https://${auth0Domain}/api/v2/connections/${encodeURIComponent(value)}`, {
      headers: {
        Authorization: `Bearer ${managementApiToken}`,
        'Content-Type': 'application/json',
      },
    })
    if (!resp.ok) return value
    const json: any = await resp.json()
    const name = typeof json?.name === 'string' ? json.name : null
    return name || value
  } catch {
    return value
  }
}

async function getManagementApiToken(): Promise<string> {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MANAGEMENT_API_CLIENT_ID
  const clientSecret = process.env.AUTH0_MANAGEMENT_API_CLIENT_SECRET

  if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error('Missing Auth0 management API env vars')
  }

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
