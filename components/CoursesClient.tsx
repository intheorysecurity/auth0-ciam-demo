'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Course } from '@/lib/courses'

type CoursesClientProps = {
  courses: Course[]
  isAuthenticated: boolean
  organizationId?: string | null
  requireProfileCompletion?: boolean
  profileCompletionUrl?: string | null
}

export default function CoursesClient({
  courses,
  isAuthenticated,
  organizationId,
  requireProfileCompletion = false,
  profileCompletionUrl = null,
}: CoursesClientProps) {
  const [actionId, setActionId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [enrolledCourses, setEnrolledCourses] = useState<Set<string>>(() => new Set())
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const loginHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set('returnTo', '/courses')
    if (organizationId) params.set('organization', organizationId)
    return `/api/auth/login?${params.toString()}`
  }, [organizationId])

  useEffect(() => {
    if (!isAuthenticated) {
      setEnrolledCourses(new Set())
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch('/api/courses/enrollment', { cache: 'no-store' })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) return
        const list = Array.isArray(data?.enrolled_courses) ? data.enrolled_courses : []
        if (!cancelled) setEnrolledCourses(new Set(list.filter((x: any) => typeof x === 'string')))
      } catch {
        // ignore (demo)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (requireProfileCompletion) {
      setProfileModalOpen(true)
    } else {
      setProfileModalOpen(false)
    }
  }, [requireProfileCompletion])

  async function enroll(courseId: string) {
    setMessage(null)
    setActionId(courseId)
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
      const list = Array.isArray(data?.enrolled_courses) ? data.enrolled_courses : null
      if (list) setEnrolledCourses(new Set(list.filter((x: any) => typeof x === 'string')))
      setMessage({ type: 'success', text: 'You are enrolled. See you in class.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Enrollment failed.' })
    } finally {
      setActionId(null)
    }
  }

  async function unenroll(courseId: string) {
    setMessage(null)
    setActionId(courseId)
    try {
      const resp = await fetch('/api/courses/unenroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        const details = typeof data?.details === 'string' ? data.details : ''
        setMessage({ type: 'error', text: details || data?.error || 'Unenroll failed.' })
        return
      }
      const list = Array.isArray(data?.enrolled_courses) ? data.enrolled_courses : null
      if (list) setEnrolledCourses(new Set(list.filter((x: any) => typeof x === 'string')))
      setMessage({ type: 'success', text: 'You are unenrolled.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Unenroll failed.' })
    } finally {
      setActionId(null)
    }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {profileModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
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
            style={{
              width: 'min(720px, calc(100vw - 32px))',
              borderRadius: 14,
              border: '1px solid rgba(0,0,0,0.12)',
              background: 'white',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, color: '#2f242c' }}>
              More profile info required
            </div>
            <div style={{ marginTop: 8, color: '#2f242c', opacity: 0.85, lineHeight: 1.45 }}>
              Before you can access courses, we need a little more information (first name and last name).
              Click Continue to complete your profile.
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                style={{ background: 'var(--primary-color, #2f242c)', color: 'white', border: 'none' }}
                onClick={() => {
                  const href = profileCompletionUrl || '/api/auth/login?pp=1&returnTo=/courses'
                  window.location.href = href
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
          (() => {
            const isEnrolled = enrolledCourses.has(c.id)
            const isBusy = actionId === c.id
            return (
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
                  onClick={() => (isEnrolled ? unenroll(c.id) : enroll(c.id))}
                  disabled={isBusy}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: 10,
                    border: 'none',
                    background: isEnrolled ? 'white' : 'var(--primary-color, #2f242c)',
                    color: isEnrolled ? '#2f242c' : 'white',
                    boxShadow: isEnrolled ? 'inset 0 0 0 1px #e0e0e0' : undefined,
                    fontWeight: 800,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.7 : 1,
                  }}
                >
                  {isBusy ? (isEnrolled ? 'Unenrolling…' : 'Enrolling…') : isEnrolled ? 'Unenroll' : 'Enroll'}
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
            )
          })()
        ))}
      </div>
    </div>
  )
}

