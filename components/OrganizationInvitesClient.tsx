'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function OrganizationInvitesClient({ orgName }: { orgName: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sendInvitationEmail, setSendInvitationEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInvitationUrl(null)

    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter an email address.')
      return
    }

    setIsSubmitting(true)
    try {
      const resp = await fetch(`/api/organizations/${encodeURIComponent(orgName)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          sendInvitationEmail,
        }),
      })

      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        const details = typeof data?.details === 'string' ? data.details : ''
        setError(details || 'Failed to send invitation.')
        return
      }

      setEmail('')
      setSuccess(sendInvitationEmail ? 'Invitation sent.' : 'Invitation created.')

      const url =
        typeof data?.invitation_url === 'string'
          ? data.invitation_url
          : typeof data?.invitationUrl === 'string'
            ? data.invitationUrl
            : null
      setInvitationUrl(url)

      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitation.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess('Invitation link copied.')
    } catch {
      setSuccess('Copy failed. Please copy manually.')
    }
  }

  return (
    <div
      style={{
        padding: '1rem',
        borderRadius: 12,
        border: '1px solid #e0e0e0',
        background: '#f8f9fa',
      }}
    >
      <div style={{ fontWeight: 800, color: '#2f242c', marginBottom: 8 }}>Invite a member</div>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          style={{
            flex: '1 1 280px',
            padding: '0.7rem 0.9rem',
            borderRadius: 10,
            border: '1px solid #dcdcdc',
            background: 'white',
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.7rem 1rem',
            borderRadius: 10,
            border: 'none',
            background: 'var(--primary-color, #2f242c)',
            color: 'white',
            fontWeight: 800,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, color: '#2f242c' }}>
        <input
          type="checkbox"
          checked={sendInvitationEmail}
          onChange={(e) => setSendInvitationEmail(e.target.checked)}
        />
        <span style={{ fontSize: '0.9rem' }}>
          Send invitation email (if disabled, you’ll get an invite link to share)
        </span>
      </label>

      {error ? (
        <div style={{ marginTop: 10, color: '#7a1b1b', fontSize: '0.9rem' }}>{error}</div>
      ) : null}

      {success ? (
        <div style={{ marginTop: 10, color: '#1f5a2a', fontSize: '0.9rem' }}>{success}</div>
      ) : null}

      {!sendInvitationEmail && invitationUrl ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.85rem', color: '#6b6b6b', marginBottom: 6 }}>Invitation URL</div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <code
              style={{
                flex: '1 1 520px',
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                background: 'white',
                overflowX: 'auto',
              }}
            >
              {invitationUrl}
            </code>
            <button
              type="button"
              onClick={() => copy(invitationUrl)}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: 10,
                border: '1px solid #e0e0e0',
                background: 'white',
                color: '#2f242c',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

