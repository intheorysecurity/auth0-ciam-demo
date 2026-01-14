/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow images from social media providers
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.twimg.com',
      },
    ],
  },
  // IMPORTANT: Next.js 15 throws ERRORS (not warnings) in development mode
  // when the Auth0 SDK uses cookies() synchronously. This is a known compatibility
  // issue between @auth0/nextjs-auth0@3.8.0 and Next.js 15.2.3.
  //
  // The errors appear in the terminal but:
  // - Requests still return 200 OK
  // - Functionality works correctly
  // - This is an Auth0 SDK limitation, not our code
  //
  // Unfortunately, there's no way to suppress these errors in Next.js 15.
  // The Auth0 SDK needs to be updated to use async cookies() API.
  //
  // Workaround: These errors only appear in development mode.
  // Production builds work fine.
}

module.exports = nextConfig

