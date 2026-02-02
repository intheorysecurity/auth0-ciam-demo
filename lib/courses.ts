export type Course = {
  id: string
  title: string
  description: string
  startsAt: string
  duration: string
  seats: number
}

export const COURSES: Course[] = [
  {
    id: 'ciam-101',
    title: 'CIAM 101: Identity Fundamentals',
    description:
      'Learn the essentials of CIAM, OAuth/OIDC, and modern authentication patterns with hands-on examples.',
    startsAt: '2026-02-15T17:00:00.000Z',
    duration: '60 minutes',
    seats: 50,
  },
  {
    id: 'auth0-orgs',
    title: 'Auth0 Organizations + B2B Patterns',
    description:
      'How to model B2B tenants with Organizations, connections, invitations, roles, and admin experiences.',
    startsAt: '2026-02-22T17:00:00.000Z',
    duration: '75 minutes',
    seats: 40,
  },
  {
    id: 'mfa-rollout',
    title: 'MFA Rollout Playbook',
    description:
      'Deploy MFA safely: verification, enrollment UX, recovery, and common pitfalls across factors.',
    startsAt: '2026-03-01T17:00:00.000Z',
    duration: '60 minutes',
    seats: 40,
  },
]

export function isValidCourseId(courseId: string): boolean {
  return COURSES.some((c) => c.id === courseId)
}

