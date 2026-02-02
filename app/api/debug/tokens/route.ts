import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

function base64UrlToUtf8(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const json = base64UrlToUtf8(parts[1])
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const enabled =
    process.env.NODE_ENV === 'development' ||
    process.env.ENABLE_TOKEN_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_TOKEN_DEBUG === 'true'

  if (!enabled) {
    // Don’t advertise this endpoint in production.
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = typeof (session as any)?.accessToken === 'string' ? (session as any).accessToken : null
  const idToken = typeof (session as any)?.idToken === 'string' ? (session as any).idToken : null

  return NextResponse.json(
    {
      // Intentionally NOT returning raw JWTs (only decoded payload JSON).
      // This keeps the debug endpoint lower-risk if it’s accidentally enabled.
      accessTokenPayload: accessToken ? decodeJwtPayload(accessToken) : null,
      idTokenPayload: idToken ? decodeJwtPayload(idToken) : null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

