/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Harden all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Global CSP — does NOT set frame-ancestors here (those are
          // per-route below). When multiple CSP headers are sent, browsers
          // intersect the directives, so the per-route frame-ancestors
          // rules continue to apply on top of this baseline.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-inline' + 'unsafe-eval' are required by Clerk and Next's
              // dev/runtime chunks. Tightening to nonce-based CSP is a future
              // hardening pass.
              // Clerk Frontend API runs on a custom subdomain (clerk.<your-app-domain>)
              // when using a production publishable key. Both script-src AND connect-src
              // must allow it or sign-in fails silently with CSP-blocked requests.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.app.ngfsystems.com https://js.stripe.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              // data: + blob: for icons & local previews; https: covers Vercel
              // Blob, Clerk avatars, and any uploaded image URL.
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.app.ngfsystems.com https://api.stripe.com https://www.google-analytics.com https://*.googletagmanager.com https://*.vercel-storage.com https://*.public.blob.vercel-storage.com",
              // frame-src https: lets the portal editor iframe arbitrary client
              // sites; specific carve-outs for Stripe Elements + Clerk Captcha.
              "frame-src 'self' https: https://*.stripe.com https://challenges.cloudflare.com https://clerk.app.ngfsystems.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        // Preview iframe: only embeddable from same origin (the editor)
        source: '/portal/website/preview',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
      {
        // All other portal pages: no embedding at all
        source: '/portal/((?!website/preview).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
