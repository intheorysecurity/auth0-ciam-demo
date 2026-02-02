import { getSession } from '@auth0/nextjs-auth0'
import { NextRequest, NextResponse } from 'next/server'

const REQUIRED_ACR = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'

function base64UrlToUtf8(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(base64UrlToUtf8(parts[1]))
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // @ts-ignore - getSession works with NextRequest in App Router
  const session = await getSession(request)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idToken = typeof (session as any)?.idToken === 'string' ? ((session as any).idToken as string) : null
  const accessToken =
    typeof (session as any)?.accessToken === 'string' ? ((session as any).accessToken as string) : null

  const idPayload = idToken ? decodeJwtPayload(idToken) : null
  const atPayload = accessToken ? decodeJwtPayload(accessToken) : null

  const acr = (idPayload && typeof idPayload.acr === 'string' && idPayload.acr) ||
              (atPayload && typeof atPayload.acr === 'string' && atPayload.acr) ||
              null

  const ok = acr === REQUIRED_ACR

  const reauthUrl =
    ok
      ? null
      : `/api/auth/login?returnTo=/profile&acr_values=${encodeURIComponent(REQUIRED_ACR)}&prompt=login&max_age=0`

  return NextResponse.json(
    {
      ok,
      requiredAcr: REQUIRED_ACR,
      acr,
      reauthUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

