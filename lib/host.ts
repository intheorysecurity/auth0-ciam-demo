export function getHostNoPort(hostname: string): string {
  return (hostname || '').split(',')[0].trim().split(':')[0].toLowerCase()
}

/**
 * Returns candidate org names derived from the hostname.
 * We intentionally keep this generic so the app works for arbitrary custom domains.
 *
 * Examples:
 * - Local dev: `acme.localhost` -> ["acme"]
 * - Subdomain: `acme.example.com` -> ["acme"]
 * - "app." prefix: `app.acme.example.com` -> ["acme"]
 */
export function getOrgNameCandidatesFromHostname(hostname: string): string[] {
  const host = getHostNoPort(hostname)
  if (!host) return []

  // Localhost: org.localhost
  if (host.endsWith('.localhost')) {
    const parts = host.split('.')
    const candidate = parts[0]
    if (candidate && candidate !== 'localhost' && candidate !== '127') return [candidate]
    return []
  }

  // Generic subdomain: org.example.com (3+ labels)
  const parts = host.split('.')
  if (parts.length > 2 && parts[0] !== 'localhost' && parts[0] !== '127') {
    // If there is a fixed prefix like "app.", treat the next label as the candidate org.
    if (parts[0] === 'app' || parts[0] === 'www') {
      return parts[1] ? [parts[1]] : []
    }
    return [parts[0]]
  }

  return []
}

