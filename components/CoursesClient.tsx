'use client'

import { useMemo, useState } from 'react'
import type { Course } from '@/lib/courses'

type CoursesClientProps = {
  courses: Course[]
  isAuthenticated: boolean
  organizationId?: string | null
}

export default function CoursesClient({ courses, isAuthenticated, organizationId }: CoursesClientProps) {
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loginHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set('returnTo', '/courses')
    if (organizationId) params.set('organization', organizationId)
    return `/api/auth/login?${params.toString()}`
  }, [organizationId])

  async function enroll(courseId: string) {
    setMessage(null)
    setEnrollingId(courseId)
    try {
      const resp = await fetch('/api/courses/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        const details = typeof data?.details === 'string' ? data.details : ''
        setMessage({ type: 'error', text: details || data?.error || 'Enrollment failed.' })
        return
      }
      setMessage({ type: 'success', text: 'You are enrolled. See you in class.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Enrollment failed.' })
    } finally {
      setEnrollingId(null)
    }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {message ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: 10,
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            background: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            fontWeight: 600,
          }}
        >
          {message.text}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {courses.map((c) => (
          <div
            key={c.id}
            style={{
              padding: '1.25rem',
              border: '1px solid #e0e0e0',
              borderRadius: 16,
              background: 'white',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#6b6b6b', marginBottom: 8 }}>
              {new Date(c.startsAt).toLocaleString()} • {c.duration} • {c.seats} seats
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2f242c', marginBottom: 6 }}>
              {c.title}
            </div>
            <div style={{ color: '#2f242c', opacity: 0.9, lineHeight: 1.45 }}>{c.description}</div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => enroll(c.id)}
                  disabled={enrollingId === c.id}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--primary-color, #2f242c)',
                    color: 'white',
                    fontWeight: 800,
                    cursor: enrollingId === c.id ? 'not-allowed' : 'pointer',
                    opacity: enrollingId === c.id ? 0.7 : 1,
                  }}
                >
                  {enrollingId === c.id ? 'Enrolling…' : 'Enroll'}
                </button>
              ) : (
                <a
                  href={loginHref}
                  style={{
                    display: 'inline-block',
                    padding: '0.6rem 1rem',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--primary-color, #2f242c)',
                    color: 'white',
                    textDecoration: 'none',
                    fontWeight: 800,
                  }}
                >
                  Login to enroll
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

