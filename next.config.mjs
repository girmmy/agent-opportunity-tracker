/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * Baseline security headers.
   *
   * The session cookie is SameSite=Lax, so a cross-site iframe already loads
   * unauthenticated and clickjacking an authenticated action is largely blocked
   * on its own. These are defense in depth rather than the primary control:
   * frame-ancestors closes framing outright, nosniff prevents MIME confusion,
   * and the referrer policy keeps the app's URLs out of third-party logs when
   * following a listing link.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            // Next injects inline styles and hydration scripts, so
            // 'unsafe-inline' is required here; the meaningful directives are
            // frame-ancestors and the connect/img restrictions.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // The résumé-preview iframe on the profile page embeds this one route
        // from the app itself. The blanket frame-ancestors 'none' above blocks
        // that too — same-origin framing isn't exempted by default — so this
        // narrower, later-defined block overrides just the two frame-control
        // headers for this one path. Session auth on the route itself is the
        // real boundary; nothing here weakens it for anything else.
        source: '/api/profile/resume',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
