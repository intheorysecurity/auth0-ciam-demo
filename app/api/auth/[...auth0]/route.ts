import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

// Helper function to extract base URL from NextRequest (App Router)
function getBaseUrlFromNextRequest(request: NextRequest): string {
  // Use nextUrl which has the full URL including hostname
  if (request.nextUrl) {
    return `${request.nextUrl.protocol}//${request.nextUrl.host}`
  }
  
  // Fallback: try headers
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  
  if (host) {
    return `${protocol}://${host}`
  }
  
  // Final fallback
  return process.env.AUTH0_BASE_URL || 'http://localhost:3000'
}

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
      console.log('getBaseUrlFromRequest - Using headers, host:', host)
      return `${protocol}://${host}`
    }
  }
  
  // Fallback: try nextUrl (but this might be normalized)
  if ('nextUrl' in req && req.nextUrl) {
    const nextUrl = req.nextUrl
    console.log('getBaseUrlFromRequest - Using nextUrl, host:', nextUrl.host)
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
  
  // Debug logging
  console.log('Login handler - Request object keys:', Object.keys(req))
  console.log('Login handler - Base URL:', baseUrl)
  console.log('Login handler - Callback URL:', callbackUrl)
  if ('headers' in req) {
    const headers = req.headers
    if (headers instanceof Headers) {
      console.log('Login handler - Host header:', headers.get('host'))
      console.log('Login handler - X-Forwarded-Host:', headers.get('x-forwarded-host'))
    } else {
      console.log('Login handler - Headers object:', headers)
    }
  }
  
  // Extract query parameters - handle both NextRequest (App Router) and NextApiRequest (Pages Router)
  let organization: string | null = null
  let screenHint: string | null = null
  
  if ('url' in req && req.url) {
    // NextRequest (App Router) - use URL API
    try {
      const url = new URL(req.url)
      organization = url.searchParams.get('organization')
      screenHint = url.searchParams.get('screen_hint')
    } catch {
      // URL parsing failed, skip
    }
  } else if ('query' in req && req.query) {
    // NextApiRequest (Pages Router) - use query object
    organization = (req.query.organization as string) || null
    screenHint = (req.query.screen_hint as string) || null
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
  
  console.log('Login handler - Authorization params:', customParams)
  
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
  
  console.log('Callback handler - Base URL:', baseUrl)
  console.log('Callback handler - Redirect URI:', redirectUri)
  console.log('Callback handler - Return To:', returnTo)
  
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
  
  console.log('Route handler - Host header:', request.headers.get('host'))
  console.log('Route handler - X-Forwarded-Host:', request.headers.get('x-forwarded-host'))
  console.log('Route handler - Base URL from headers:', baseUrl)
  console.log('Route handler - Request URL:', request.url)
  console.log('Route handler - NextURL host:', request.nextUrl?.host)
  
  // Call the auth handler with both request and context
  return authHandler(request, context)
}
