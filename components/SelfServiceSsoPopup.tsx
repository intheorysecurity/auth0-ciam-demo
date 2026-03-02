'use client'

import { useCallback, useMemo, useState } from 'react'

type Props = {
  orgName: string
}

export default function SelfServiceSsoPopup({ orgName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticketUrl, setTicketUrl] = useState<string | null>(null)
  const [iframeOpen, setIframeOpen] = useState(false)

  const endpoint = useMemo(() => {
    return `/api/organizations/${encodeURIComponent(orgName)}/sso-ticket`
  }, [orgName])

  const createTicket = useCallback(async (): Promise<string> => {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      const details = typeof data?.details === 'string' ? data.details : ''
      throw new Error(details || data?.error || 'Failed to create SSO setup ticket.')
    }
    const url = typeof data?.ticketUrl === 'string' ? data.ticketUrl : null
    if (!url) {
      throw new Error('Ticket response missing URL.')
    }
    return url
  }, [endpoint])

  const openPopup = useCallback(async () => {
    setError(null)
    setLoading(true)
    setTicketUrl(null)
    setIframeOpen(false)

    // Open a blank window synchronously (avoids popup blockers).
    // Avoid putting noopener/noreferrer into the feature string; some browsers treat that inconsistently.
    const features = [
      'popup=yes',
      'width=900',
      'height=760',
    ].join(',')
    const popup = window.open('', 'auth0-self-service-sso', features)

    try {
      if (!popup) {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.')
      }

      // Defensive: cut the opener reference even if the browser ignores noopener.
      try {
        ;(popup as any).opener = null
      } catch {
        // ignore
      }

      // Show immediate feedback in the popup.
      try {
        popup.document.title = 'Opening SSO setup…'
        popup.document.body.innerHTML = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px;">
            <div style="font-weight: 800; font-size: 16px; margin-bottom: 8px;">Opening SSO setup…</div>
            <div style="opacity: 0.75; line-height: 1.5;">Please wait while we create your Self‑Service SSO setup ticket.</div>
          </div>
        `
      } catch {
        // ignore
      }

      const url = await createTicket()

      setTicketUrl(url)

      if (popup.closed) {
        setError('Popup was closed before it could be opened. Use the manual link below.')
        return
      }

      // Navigate the popup.
      popup.location.href = url
      try {
        popup.focus()
      } catch {
        // ignore
      }
    } catch (e: any) {
      // If we managed to create a ticket URL, keep it as a manual fallback.
      const msg = e?.message || 'Failed to open SSO setup.'
      setError(msg)
      try {
        if (popup && !popup.closed) popup.close()
      } catch {
        // ignore
      }
    } finally {
      setLoading(false)
    }
  }, [createTicket])

  const openInIframe = useCallback(async () => {
    setError(null)
    setLoading(true)
    setTicketUrl(null)
    setIframeOpen(false)
    try {
      const url = await createTicket()
      setTicketUrl(url)
      setIframeOpen(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to create SSO setup ticket.')
    } finally {
      setLoading(false)
    }
  }, [createTicket])

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={openPopup}
          disabled={loading}
          style={{
            display: 'inline-block',
            padding: '0.6rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary-color, #2f242c)',
            color: 'white',
            textDecoration: 'none',
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? 'Opening…' : 'Open in popup'}
        </button>

        <button
          type="button"
          onClick={openInIframe}
          disabled={loading}
          style={{
            display: 'inline-block',
            padding: '0.6rem 1rem',
            borderRadius: 10,
            border: '1px solid #e0e0e0',
            background: 'white',
            color: '#2f242c',
            textDecoration: 'none',
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.75 : 1,
          }}
        >
          Try in iframe (may be blocked)
        </button>
      </div>

      {iframeOpen && ticketUrl ? (
        <div
          style={{
            marginTop: '1rem',
            borderRadius: 12,
            border: '1px solid #e0e0e0',
            background: 'white',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#fff2df',
              borderBottom: '1px solid #f2d4a8',
              color: '#7a4a12',
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              Attempting iframe embed. If this appears blank, Auth0 is blocking iframes (clickjacking protection).
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIframeOpen(false)}
            >
              Close
            </button>
          </div>
          <iframe
            title="Auth0 Self-Service SSO"
            src={ticketUrl}
            style={{ width: '100%', height: 720, border: 0, background: 'white' }}
          />
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: '0.75rem', color: '#721c24', fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {ticketUrl ? (
        <div style={{ marginTop: '0.5rem', fontWeight: 700 }}>
          <a
            href={ticketUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--primary-color, #2f242c)' }}
          >
            Open SSO setup manually
          </a>
        </div>
      ) : null}
    </div>
  )
}

