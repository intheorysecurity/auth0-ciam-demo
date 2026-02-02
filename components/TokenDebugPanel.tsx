'use client'

import { useCallback, useEffect, useState } from 'react'

type TokenDebugResponse = {
  accessTokenPayload?: any | null
  idTokenPayload?: any | null
  error?: string
}

function prettyJson(value: any): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function TokenDebugPanel() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TokenDebugResponse | null>(null)

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }, [])

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/debug/tokens', { cache: 'no-store' })
      const json = (await resp.json()) as TokenDebugResponse
      if (!resp.ok) {
        setError(json?.error || `Request failed (${resp.status})`)
        setData(null)
        return
      }
      setData(json)
    } catch (e: any) {
      setError(e?.message || 'Failed to load tokens')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: 'grid',
        gap: '0.5rem',
        maxWidth: 'min(720px, calc(100vw - 32px))',
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          if (!data && !loading) {
            fetchTokens()
          }
        }}
        style={{
          justifySelf: 'end',
          padding: '0.55rem 0.85rem',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.12)',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        Token claims
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: 'min(980px, calc(100vw - 32px))',
              maxHeight: 'min(75vh, 700px)',
              overflow: 'auto',
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Decoded token claims</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setData(null)
                    fetchTokens()
                  }}
                  disabled={loading}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {error ? <div style={{ color: '#b00020', fontWeight: 700 }}>{error}</div> : null}
              {loading && !data ? <div>Loading…</div> : null}
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 14 }}>
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>ID token claims</div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copy(prettyJson(data?.idTokenPayload))}
                    disabled={!data}
                  >
                    Copy JSON
                  </button>
                </div>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {data ? prettyJson(data.idTokenPayload) : ''}
                </pre>
              </section>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>Access token claims</div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copy(prettyJson(data?.accessTokenPayload))}
                    disabled={!data}
                  >
                    Copy JSON
                  </button>
                </div>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {data ? prettyJson(data.accessTokenPayload) : ''}
                </pre>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

