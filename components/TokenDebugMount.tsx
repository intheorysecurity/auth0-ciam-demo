import TokenDebugPanel from '@/components/TokenDebugPanel'

export default function TokenDebugMount() {
  const enabled =
    process.env.NODE_ENV === 'development' ||
    process.env.ENABLE_TOKEN_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_TOKEN_DEBUG === 'true'

  if (!enabled) return null

  return <TokenDebugPanel />
}

