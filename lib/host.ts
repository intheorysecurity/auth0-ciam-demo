export function getHostNoPort(hostname: string): string {
  return (hostname || '').split(',')[0].trim().split(':')[0].toLowerCase()
}

/**
 * Multi-tenant org detection.
 *
 * Supports:
 * - Local dev: `<org>.localhost` (org = first label)
 * - Standard subdomain: `<org>.<domain>` (org = first label, when domain has 3+ labels)
 * - Ngrok pattern where "app" is a fixed prefix:
 *   - Root: `app.<rootLabel>.<suffix>` (no org)
 *   - Org:  `app.<orgLabel>.<suffix>` (org = second label)
 *
 * Configure the ngrok/root pattern by setting APP_ROOT_HOSTNAME, e.g.:
 *   APP_ROOT_HOSTNAME=app.intheory.ngrok.app
 */
export function getOrgNameFromHostname(hostname: string): string | null {
  const host = getHostNoPort(hostname)
  if (!host) return null

  // Localhost: org.localhost
  if (host.endsWith('.localhost')) {
    const parts = host.split('.')
    const candidate = parts[0]
    if (candidate && candidate !== 'localhost' && candidate !== '127') return candidate
    return null
  }

  const root = process.env.APP_ROOT_HOSTNAME ? getHostNoPort(process.env.APP_ROOT_HOSTNAME) : null
  if (root) {
    if (host === root) return null

    const rootParts = root.split('.')
    // Require at least: prefix + rootLabel + suffix (>= 3 labels)
    if (rootParts.length >= 3) {
      const prefix = rootParts[0]
      const rootLabel = rootParts[1]
      const suffix = rootParts.slice(2).join('.')

      // Pattern: prefix.<candidate>.<suffix>
      if (host.startsWith(`${prefix}.`) && host.endsWith(`.${suffix}`)) {
        const hostParts = host.split('.')
        // Only treat it as matching this scheme if it has the same number of labels as root
        // (e.g. app.<label>.ngrok.app)
        if (hostParts.length === rootParts.length) {
          const candidate = hostParts[1]
          if (candidate && candidate !== rootLabel) return candidate
          return null
        }
      }
    }
  }

  // Generic subdomain: org.example.com (3+ labels)
  const parts = host.split('.')
  if (parts.length > 2 && parts[0] !== 'localhost' && parts[0] !== '127') {
    return parts[0]
  }

  return null
}

