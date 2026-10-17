# Security review — 17 October 2026

The original local demo was not suitable for internet hosting: its catalogue endpoint returned orders and the dashboard could edit products without signing in. Both issues are fixed in this version.

## Controls implemented

- The public catalogue returns product fields only. Order and customer records require an authenticated admin session.
- Product creation, updates, deletion and order-status changes require admin authentication.
- Password checks use scrypt and timing-safe comparison. Sessions are signed, expire after eight hours, and use HttpOnly, SameSite=Strict cookies. Hosted cookies also use Secure and the __Host- prefix. Passwords and signing secrets stay on the server.
- JSON-only mutation endpoints validate the Origin and Host. No permissive CORS headers are sent. Local development is bound to loopback only.
- Login attempts are limited. With cloud storage connected, limits are shared across instances; local limits are held in memory. Demo checkouts are limited too.
- Demo checkout accepts product selections only. It rejects personal-detail fields and automatically uses fictional customer data. It processes no payments or deliveries.
- The storefront uses local artwork and system fonts. No analytics, advertising scripts, trackers, third-party image URLs or remote font requests are included. Product image uploads accept raster data URLs only, check file signatures and enforce a 2 MB limit. Public product photographs are intentionally visible to shoppers; do not upload private documents or credentials as product photos.
- Product IDs, category, age group, prices, stock and colours are validated. Text rendered into HTML is escaped. CSV exports neutralise formula prefixes.
- Security headers restrict scripts and network requests to this origin, prevent framing, suppress referrers and disable unnecessary browser permissions. Inline CSS is allowed for product background colours; inline JavaScript is not allowed.
- Local private files are outside the public folder and served routes are allowlisted. Git and Vercel exclusions omit data, local credentials, environment files and logs. The tracked seed contains sample products and no orders.
- Mutations are serialised locally. Cloud storage uses optimistic compare-and-set to prevent lost updates and overselling.
- Hosted admin access fails closed unless strong credentials and durable cloud storage are configured. Without storage, the hosted storefront runs as a labelled, read-only preview and checkouts are not saved.

## Verification

Automated tests cover public/private data separation, unauthorised reads and writes, file access, malicious product values, forged sessions, login limits, same-origin checks, valid admin edits, checkout privacy, stock concurrency, order management, logout and hosted fail-closed behaviour. Browser checks cover desktop/mobile layout, search, categories, bag, checkout, sign-in, editing, dashboard tabs and sign-out, with no JavaScript errors or external requests observed.

These are application checks, not a guarantee of zero vulnerabilities. Hosted deployment, actual cloud database connectivity, hosting permissions and deployed security headers must still be checked after account access is available. The cloud adapter's API contract is based on the provider documentation; it has not yet been exercised against a live database.

## Operational limits

This is still a working commerce demo, not a real-payment store. Contact information, product safety information and business policies remain pending. Admin access uses a single owner password; there is no multi-user permission system, MFA or audit log. Logging out clears the browser cookie; a previously copied cookie remains valid until expiry. Rotate SESSION_SECRET to invalidate every session. Protect the computer and hosting accounts, keep backups private, and restrict database credentials to this application. Local runtime data is a plaintext JSON file and is not encrypted by the application. Hosted records are accessible to the hosting/database providers according to their service policies. No real customer details should be entered into this demo.

Report suspected issues privately to the shop owner; contact details are pending.
