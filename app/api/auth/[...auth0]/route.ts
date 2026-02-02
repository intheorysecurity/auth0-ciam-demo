import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to extract base URL from request (for use in callbacks)
function getBaseUrlFromRequest(req: any): string {
  const firstHeaderValue = (value: string | null): string | null => {
    if (!value) return null
    // Some proxies send comma-separated values; we want the first one.
    return value.split(',')[0].trim() || null
  }

  // PRIORITY: Headers first (most reliable for subdomains)
  // nextUrl might be normalized and lose the subdomain
  if ('headers' in req) {
    const headers = req.headers
    // Handle both Headers object (App Router) and plain object (Pages Router)
    let host: string | null = null
    let protocol = 'http'
    
    if (headers instanceof Headers) {
      // App Router - Headers object
      // Prefer x-forwarded-* (proxy-aware) over host.
      host = firstHeaderValue(headers.get('x-forwarded-host')) || firstHeaderValue(headers.get('host'))
      const proto = firstHeaderValue(headers.get('x-forwarded-proto'))
      protocol = proto ? proto.split(',')[0].trim() : (headers.get('x-forwarded-port') === '443' ? 'https' : 'http')
    } else if (typeof headers === 'object' && headers !== null) {
      // Pages Router - plain object
      // Prefer x-forwarded-* (proxy-aware) over host.
      host =
        firstHeaderValue((headers['x-forwarded-host'] as string) || null) ||
        firstHeaderValue((headers.host as string) || null) ||
        null
      const proto = firstHeaderValue((headers['x-forwarded-proto'] as string) || null)
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
const loginHandler = handleLogin((req) => {
  // Get the base URL from the request (includes subdomain if present)
  const baseUrl = getBaseUrlFromRequest(req)
  const callbackUrl = `${baseUrl}/api/auth/callback`
  
  // Extract query parameters - handle both NextRequest (App Router) and NextApiRequest (Pages Router)
  let organization: string | null = null
  let screenHint: string | null = null
  let connection: string | null = null
  let returnTo: string | null = null
  let pp: string | null = null
  let acrValues: string | null = null
  let prompt: string | null = null
  let maxAge: string | null = null
  
  if ('url' in req && req.url) {
    // NextRequest (App Router) - use URL API
    try {
      const url = new URL(req.url)
      organization = url.searchParams.get('organization')
      screenHint = url.searchParams.get('screen_hint')
      connection = url.searchParams.get('connection')
      returnTo = url.searchParams.get('returnTo')
      pp = url.searchParams.get('pp')
      acrValues = url.searchParams.get('acr_values')
      prompt = url.searchParams.get('prompt')
      maxAge = url.searchParams.get('max_age')
    } catch {
      // URL parsing failed, skip
    }
  } else if ('query' in req && req.query) {
    // NextApiRequest (Pages Router) - use query object
    organization = (req.query.organization as string) || null
    screenHint = (req.query.screen_hint as string) || null
    connection = (req.query.connection as string) || null
    returnTo = (req.query.returnTo as string) || null
    pp = (req.query.pp as string) || null
    acrValues = (req.query.acr_values as string) || null
    prompt = (req.query.prompt as string) || null
    maxAge = (req.query.max_age as string) || null
  }
  
  // Build authorization params - include redirect_uri to ensure it matches the request hostname
  // This merges with the SDK's default params (including PKCE) rather than replacing them
  const customParams: Record<string, string> = {
    redirect_uri: callbackUrl,
  }

  // Ensure we request an access token during login by setting an audience.
  // Priority:
  // - AUTH0_AUDIENCE (explicit override)
  // - Management API audience format (demo default): https://<AUTH0_DOMAIN>/api/v2/
  const defaultAudience =
    process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/api/v2/` : ''
  const audience = (process.env.AUTH0_AUDIENCE || defaultAudience).trim()
  if (audience) {
    customParams.audience = audience
  }
  
  if (organization) customParams.organization = organization
  
  if (screenHint) {
    customParams.screen_hint = screenHint
  }

  // If a specific connection was selected in the UI, pass it through to /authorize.
  // Auth0 expects the *connection name* here.
  if (connection) {
    customParams.connection = resolveAuth0ConnectionName(connection)
  }

  // Demo-only progressive profiling toggle: forward pp=1 to /authorize so Actions can detect it.
  if (pp) customParams.pp = pp

  // Allow callers to request step-up auth / MFA via ACR.
  // Example: acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor
  if (acrValues) customParams.acr_values = acrValues

  // Optional: force re-authentication
  if (prompt) customParams.prompt = prompt
  if (maxAge) customParams.max_age = maxAge

  // Allow callers to specify a relative returnTo (e.g. /courses). Prevent open redirects.
  const safeReturnTo =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/profile'
  
  return {
    authorizationParams: customParams,
    // IMPORTANT: keep redirects on the same host as the incoming request.
    // Using a relative path avoids accidentally falling back to AUTH0_BASE_URL (localhost)
    // or other normalization issues that can drop the org subdomain.
    returnTo: safeReturnTo,
  }
})

// Custom callback handler that uses dynamic redirect URI and preserves subdomain
const callbackHandler = handleCallback((req) => {
  const baseUrl = getBaseUrlFromRequest(req)
  const redirectUri = `${baseUrl}/api/auth/callback`

  return {
    redirectUri,
  }
})

// Custom logout handler that returns users to the same host they initiated logout from
// (preserves org subdomain branding).
const logoutHandler = handleLogout((req) => {
  const baseUrl = getBaseUrlFromRequest(req)
  return {
    returnTo: `${baseUrl}/`,
  }
})

// Create a wrapper that extracts hostname at route level
const authHandler = handleAuth({
  login: loginHandler,
  callback: callbackHandler,
  logout: logoutHandler,
})

// Export GET handler that wraps the auth handler
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ auth0: string[] }> }
) {
  const resolvedParams = await context.params
  const ctx = { params: resolvedParams } as any

  // Extract base URL from the actual NextRequest (this has the full hostname)
  // Use headers to get the actual hostname (including subdomain)
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request.headers.get('host')?.split(',')[0].trim() ||
    'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
                   (request.url.startsWith('https') ? 'https' : 'http')
  const baseUrl = `${protocol}://${host}`
  
  // If Auth0 redirects back to the callback with an error (e.g. "the connection is not enabled"),
  // handle it gracefully by redirecting to the home page and showing the error there.
  // Example:
  // /api/auth/callback?error=invalid_request&error_description=the%20connection%20is%20not%20enabled
  if (ctx?.params?.auth0?.[0] === 'callback') {
    const error = request.nextUrl.searchParams.get('error')
    if (error) {
      const description = request.nextUrl.searchParams.get('error_description') || ''
      const redirectTo = new URL('/auth-error', baseUrl)
      redirectTo.searchParams.set('error', error)
      if (description) redirectTo.searchParams.set('error_description', description)
      return NextResponse.redirect(redirectTo)
    }
  }

  // Call the auth handler with both request and context
  try {
    return await authHandler(request, ctx)
  } catch (err: any) {
    // Common failure mode when cookies are not set/sent back to the callback route.
    // Example: "Missing state cookie from login request"
    if (ctx?.params?.auth0?.[0] === 'callback') {
      const redirectTo = new URL('/auth-error', baseUrl)
      redirectTo.searchParams.set('error', err?.code || 'callback_handler_failed')
      const description =
        err?.cause?.message ||
        err?.message ||
        'Callback handler failed. Missing state cookie from login request.'
      redirectTo.searchParams.set('error_description', description)
      return NextResponse.redirect(redirectTo)
    }
    throw err
  }
}

function resolveAuth0ConnectionName(connectionParam: string): string {
  const value = connectionParam.trim()
  if (!value) return value

  // Legacy demo placeholders (if a connection "id-like" value is ever passed in)
  if (value === 'con_passwordless_email') return 'email'
  if (value === 'con_passwordless_sms') return 'sms'

  // Otherwise assume it's already a connection name (e.g. Username-Password-Authentication, google-oauth2, etc.)
  return value
}
