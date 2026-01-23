import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@auth0/nextjs-auth0'
import OrganizationInvitesClient from '@/components/OrganizationInvitesClient'
import AppNav from '@/components/AppNav'

type OrgDetails = {
  id: string
  name: string
  displayName?: string
  branding?: {
    logo?: string | null
    icon?: string | null
    primaryColor?: string
    secondaryColor?: string
    colors?: Record<string, string>
  }
  connections?: Array<{ id: string; name: string; displayName: string }>
}

function getBaseUrlFromHeaders(headersList: Headers): string {
  const hostnameRaw = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000'
  const hostname = hostnameRaw.split(',')[0].trim()
  const protocol = headersList.get('x-forwarded-proto')?.split(',')[0].trim() || 'http'
  return `${protocol}://${hostname}`
}

type OrgMemberRow = {
  user_id: string
  name: string | null
  email: string | null
  picture: string | null
  roles: Array<{ id: string; name: string; description?: string }>
}

type OrgInvitationRow = {
  id?: string
  created_at?: string
  expires_at?: string
  invitee?: { email?: string }
  inviter?: { name?: string }
}

export default async function OrganizationDetailsPage({
  params,
}: {
  params: { orgName: string }
}) {
  const session = await getSession()

  const headersList = await headers()
  const baseUrl = getBaseUrlFromHeaders(headersList)

  const orgName = params.orgName

  const resp = await fetch(`${baseUrl}/api/organizations/${encodeURIComponent(orgName)}`, {
    cache: 'no-store',
  })

  if (!resp.ok) {
    const message =
      resp.status === 404
        ? 'Organization not found.'
        : 'Failed to load organization details.'

    return (
      <div className="welcome-container">
        <AppNav title="CIAM Platform" orgName={null} showHome showProfile showAuth />

        <div style={{ maxWidth: 860, margin: '3rem auto', padding: '0 1.5rem' }}>
          <div
            style={{
              padding: '1.75rem',
              background: '#f8f9fa',
              borderRadius: 16,
              border: '1px solid #e0e0e0',
            }}
          >
            <h1 style={{ margin: 0, marginBottom: '0.5rem', color: '#2f242c' }}>
              Organization details unavailable
            </h1>
            <p style={{ margin: 0, color: '#6b6b6b' }}>{message}</p>
            <div style={{ marginTop: '1.25rem' }}>
              <Link
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '0.6rem 1rem',
                  borderRadius: 10,
                  border: '1px solid #e0e0e0',
                  background: 'white',
                  color: '#2f242c',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const org = (await resp.json()) as OrgDetails

  // Protect member/invite data behind login
  if (!session?.user) {
    redirect(`${baseUrl}/api/auth/login?organization=${encodeURIComponent(org.id)}`)
  }

  const brandingStyles = org?.branding
    ? `
      :root {
        ${org.branding.primaryColor ? `--primary-color: ${org.branding.primaryColor};` : ''}
        ${org.branding.secondaryColor ? `--secondary-color: ${org.branding.secondaryColor};` : ''}
        ${org.branding.secondaryColor ? `--bg-secondary: ${org.branding.secondaryColor};` : ''}
      }
    `
    : ''

  const connections = org.connections ?? []

  // When the Server Component calls internal API routes, it must forward the user's cookies
  // so those routes can read the Auth0 session.
  const cookie = headersList.get('cookie') || ''

  const [membersResp, invitationsResp] = await Promise.all([
    fetch(`${baseUrl}/api/organizations/${encodeURIComponent(orgName)}/members`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    }),
    fetch(`${baseUrl}/api/organizations/${encodeURIComponent(orgName)}/invitations`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    }),
  ])

  const membersData = membersResp.ok ? await membersResp.json().catch(() => null) : null
  const invitationsData = invitationsResp.ok ? await invitationsResp.json().catch(() => null) : null

  const members: OrgMemberRow[] = Array.isArray(membersData?.members) ? membersData.members : []
  const invitations: OrgInvitationRow[] = Array.isArray(invitationsData?.invitations)
    ? invitationsData.invitations
    : Array.isArray(invitationsData)
      ? invitationsData
      : []

  return (
    <>
      {brandingStyles && <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />}

      <div className="welcome-container">
        <AppNav
          logoUrl={org?.branding?.logo || null}
          logoAlt={org.displayName || org.name || 'Organization'}
          title={org.displayName || org.name || 'Organization'}
          orgName={orgName}
          isAuthenticated={true}
          showHome
          showProfile
          showAuth
        />

        <div style={{ maxWidth: 980, margin: '3rem auto', padding: '0 1.5rem' }}>
          <div
            style={{
              padding: '1.75rem',
              background: 'white',
              borderRadius: 16,
              border: '1px solid #e0e0e0',
            }}
          >
            <h1 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--primary-color, #2f242c)' }}>
              Organization Details
            </h1>
            <p style={{ margin: 0, color: '#6b6b6b' }}>
              Extra details for <strong>{org.displayName || org.name}</strong>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b6b6b', marginBottom: 6 }}>Organization Name</div>
                <div style={{ fontWeight: 700, color: '#2f242c' }}>{org.name}</div>
              </div>

              <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b6b6b', marginBottom: 6 }}>Display Name</div>
                <div style={{ fontWeight: 700, color: '#2f242c' }}>{org.displayName || '—'}</div>
              </div>

              <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b6b6b', marginBottom: 6 }}>Organization ID</div>
                <div
                  style={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.9rem',
                    color: '#2f242c',
                    overflowX: 'auto',
                  }}
                >
                  {org.id}
                </div>
              </div>

              <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b6b6b', marginBottom: 6 }}>Branding</div>
                <div style={{ color: '#2f242c' }}>
                  <div>
                    <strong>Primary:</strong> {org.branding?.primaryColor || '—'}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <strong>Secondary:</strong> {org.branding?.secondaryColor || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h2 style={{ margin: 0, marginBottom: '0.75rem', color: '#2f242c' }}>
                Enabled Connections ({connections.length})
              </h2>
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1.6fr',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: '#f8f9fa',
                    borderBottom: '1px solid #e0e0e0',
                    fontWeight: 700,
                    color: '#2f242c',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>Display</div>
                  <div>Name</div>
                  <div>Connection ID</div>
                </div>

                {connections.length === 0 ? (
                  <div style={{ padding: '1rem', color: '#6b6b6b' }}>
                    No enabled connections were returned for this organization.
                  </div>
                ) : (
                  connections.map((c) => (
                    <div
                      key={`${c.id}-${c.name}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1.6fr',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #f0f0f0',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ color: '#2f242c', fontWeight: 600 }}>{c.displayName}</div>
                      <div
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: '0.9rem',
                          color: '#2f242c',
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: '0.9rem',
                          color: '#2f242c',
                          overflowX: 'auto',
                        }}
                      >
                        {c.id}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <Link
                  href="/"
                  style={{
                    display: 'inline-block',
                    padding: '0.6rem 1rem',
                    borderRadius: 10,
                    border: '1px solid #e0e0e0',
                    background: 'white',
                    color: '#2f242c',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Back to home
                </Link>

                <Link
                  href="/profile"
                  style={{
                    display: 'inline-block',
                    padding: '0.6rem 1rem',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--primary-color, #2f242c)',
                    color: 'white',
                    textDecoration: 'none',
                    fontWeight: 700,
                  }}
                >
                  Go to profile
                </Link>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem' }}>
              <h2 style={{ margin: 0, marginBottom: '0.75rem', color: '#2f242c' }}>Members</h2>
              <p style={{ margin: 0, color: '#6b6b6b', marginBottom: '1rem' }}>
                Active members are shown from the Organization Members API; pending members are shown from the
                Invitations API.
              </p>

              <OrganizationInvitesClient orgName={orgName} />

              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 800, color: '#2f242c', marginBottom: 10 }}>
                  Active Members ({members.length})
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.6fr 1.5fr 0.7fr',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#f8f9fa',
                      borderBottom: '1px solid #e0e0e0',
                      fontWeight: 700,
                      color: '#2f242c',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div>User</div>
                    <div>Email</div>
                    <div>Roles</div>
                    <div>Status</div>
                  </div>

                  {membersResp.ok ? (
                    members.length === 0 ? (
                      <div style={{ padding: '1rem', color: '#6b6b6b' }}>No members were returned.</div>
                    ) : (
                      members.map((m) => (
                        <div
                          key={m.user_id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 1.6fr 1.5fr 0.7fr',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #f0f0f0',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                            {m.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.picture}
                                alt={m.name || m.email || m.user_id}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid #e0e0e0',
                                  flex: '0 0 auto',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: '#e9ecef',
                                  border: '1px solid #e0e0e0',
                                  flex: '0 0 auto',
                                }}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#2f242c', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name || '—'}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: '#6b6b6b',
                                  fontFamily:
                                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {m.user_id}
                              </div>
                            </div>
                          </div>
                          <div style={{ color: '#2f242c' }}>{m.email || '—'}</div>
                          <div style={{ color: '#2f242c' }}>
                            {Array.isArray(m.roles) && m.roles.length > 0
                              ? m.roles.map((r) => r.name).join(', ')
                              : '—'}
                          </div>
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 999,
                                border: '1px solid #b8e3c5',
                                background: '#e7f6ec',
                                color: '#1f5a2a',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                              }}
                            >
                              Active
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <div style={{ padding: '1rem', color: '#6b6b6b' }}>
                      Failed to load members.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontWeight: 800, color: '#2f242c', marginBottom: 10 }}>
                  Pending Invitations ({invitations.length})
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 1.2fr 1.2fr 0.7fr',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#f8f9fa',
                      borderBottom: '1px solid #e0e0e0',
                      fontWeight: 700,
                      color: '#2f242c',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div>Email</div>
                    <div>Inviter</div>
                    <div>Created</div>
                    <div>Status</div>
                  </div>

                  {invitationsResp.ok ? (
                    invitations.length === 0 ? (
                      <div style={{ padding: '1rem', color: '#6b6b6b' }}>No pending invitations.</div>
                    ) : (
                      invitations.map((inv, idx) => (
                        <div
                          key={inv.id || `${inv.invitee?.email || 'invite'}-${idx}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 1.2fr 1.2fr 0.7fr',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #f0f0f0',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ color: '#2f242c' }}>{inv.invitee?.email || '—'}</div>
                          <div style={{ color: '#2f242c' }}>{inv.inviter?.name || '—'}</div>
                          <div style={{ color: '#2f242c' }}>
                            {inv.created_at ? new Date(inv.created_at).toLocaleString() : '—'}
                          </div>
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 999,
                                border: '1px solid #f2d4a8',
                                background: '#fff2df',
                                color: '#7a4a12',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                              }}
                            >
                              Pending
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <div style={{ padding: '1rem', color: '#6b6b6b' }}>
                      Failed to load invitations.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem' }}>
              <h2 style={{ margin: 0, marginBottom: '0.75rem', color: '#2f242c' }}>Self-Service SSO</h2>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 12,
                  border: '1px solid #e0e0e0',
                  background: '#f8f9fa',
                }}
              >
                <p style={{ margin: 0, color: '#2f242c' }}>
                  Let customer admins configure Enterprise SSO using Auth0’s Self‑Service SSO assistant.{' '}
                  <a
                    href="https://auth0.com/docs/authenticate/enterprise-connections/self-service-SSO"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary-color, #2f242c)', fontWeight: 700 }}
                  >
                    Learn more
                  </a>
                  .
                </p>

                <form
                  action={`/api/organizations/${encodeURIComponent(orgName)}/sso-ticket`}
                  method="POST"
                  style={{ marginTop: '1rem' }}
                >
                  <button
                    type="submit"
                    style={{
                      display: 'inline-block',
                      padding: '0.6rem 1rem',
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--primary-color, #2f242c)',
                      color: 'white',
                      textDecoration: 'none',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Create SSO setup ticket
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

