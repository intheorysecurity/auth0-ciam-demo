import { NextRequest, NextResponse } from 'next/server'

function toValidConnectionName(input: string): string {
  // Auth0 requires: ^[a-zA-Z0-9](-[a-zA-Z0-9]|[a-zA-Z0-9])*$ (no underscores, no trailing '-', no '--')
  const base = (input || '')
    .trim()
    .toLowerCase()
    // Replace any non-alphanumeric sequence with a single hyphen
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from ends
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  // Ensure non-empty and starts with an alphanumeric
  return base && /^[a-z0-9]/.test(base) ? base : 'org'
}

async function getManagementApiToken(): Promise<string> {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_MANAGEMENT_API_CLIENT_ID
  const clientSecret = process.env.AUTH0_MANAGEMENT_API_CLIENT_SECRET

  const response = await fetch(`https://${auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${auth0Domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Failed to get management API token. ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orgName: string }> }
) {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const selfServiceProfileId = process.env.AUTH0_SELF_SERVICE_SSO_PROFILE_ID

  if (!auth0Domain || !selfServiceProfileId) {
    return NextResponse.json(
      {
        error:
          'Missing configuration. Set AUTH0_DOMAIN and AUTH0_SELF_SERVICE_SSO_PROFILE_ID.',
      },
      { status: 500 }
    )
  }

  try {
    const { orgName } = await context.params
    const managementApiToken = await getManagementApiToken()

    // Look up organization ID by name (we attach it to enabled_organizations).
    const orgResp = await fetch(
      `https://${auth0Domain}/api/v2/organizations/name/${encodeURIComponent(orgName)}`,
      {
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!orgResp.ok) {
      const errorText = await orgResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Organization not found', details: errorText },
        { status: orgResp.status }
      )
    }

    const org = await orgResp.json()

    // Create a Self-Service SSO ticket to CREATE a new enterprise connection.
    // Docs: https://auth0.com/docs/authenticate/enterprise-connections/self-service-SSO/manage-self-service-sso#management-api-2
    const now = new Date()
    const safeSuffix =
      `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
        now.getUTCDate()
      ).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(
        now.getUTCMinutes()
      ).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`

    const safeOrgSlug = toValidConnectionName(orgName)
    // Keep it within Auth0's max length (docs say 128) and ensure it remains valid.
    const rawConnectionName = `${safeOrgSlug}-sso-${safeSuffix}`
    const connectionName = toValidConnectionName(rawConnectionName).slice(0, 128)
    const displayName = `${org.display_name || org.name || orgName} SSO`

    const ticketBody = {
      connection_config: {
        name: connectionName,
        display_name: displayName,
        show_as_button: true,
        options: org?.branding?.logo_url
          ? {
              // Note: Auth0 requires HTTPS for icon_url.
              icon_url: org.branding.logo_url,
            }
          : undefined,
      },
      enabled_organizations: [
        {
          organization_id: org.id,
          assign_membership_on_login: true,
          show_as_button: true,
        },
      ],
      ttl_sec: 432000, // default max (5 days)
      domain_aliases_config: {
        domain_verification: 'optional',
      },
    }

    const ticketResp = await fetch(
      `https://${auth0Domain}/api/v2/self-service-profiles/${encodeURIComponent(
        selfServiceProfileId
      )}/sso-ticket`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${managementApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketBody),
        cache: 'no-store',
      }
    )

    if (!ticketResp.ok) {
      const errorText = await ticketResp.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to create Self-Service SSO ticket', details: errorText },
        { status: ticketResp.status }
      )
    }

    const data = await ticketResp.json()
    const ticketUrl = data?.ticket
    if (!ticketUrl || typeof ticketUrl !== 'string') {
      return NextResponse.json(
        { error: 'Ticket response missing ticket URL', details: data },
        { status: 500 }
      )
    }

    // 302 to Auth0 self-service assistant URL
    return NextResponse.redirect(new URL(ticketUrl), { status: 302 })
  } catch (error: any) {
    console.error('Error creating Self-Service SSO ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create Self-Service SSO ticket', details: error?.message },
      { status: 500 }
    )
  }
}

