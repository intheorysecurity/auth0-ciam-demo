import type { Metadata } from 'next'
import { UserProvider } from '@auth0/nextjs-auth0/client'
import TokenDebugMount from '@/components/TokenDebugMount'
import './globals.css'

export const metadata: Metadata = {
  title: 'Auth0 CIAM Demo',
  description: 'Customer Identity and Access Management Demo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
          <TokenDebugMount />
        </UserProvider>
      </body>
    </html>
  )
}

