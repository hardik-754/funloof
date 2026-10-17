# Funloof — storefront and private shop dashboard

A colourful, responsive toys storefront with search, age/category filters, product details, a bag, fictional checkout, and a protected owner dashboard for product photos, descriptions, prices, stock, demo orders and CSV exports.

## Run locally

Open this folder in VS Code. Install Node.js 22 or newer, run `npm start`, and visit http://127.0.0.1:4173 in Chrome. No dependencies need installing.

- Storefront: http://127.0.0.1:4173
- Dashboard: http://127.0.0.1:4173/admin
- Your local admin password is generated on first start in `.local/admin-password.txt`. Open that file on your computer and use it on the sign-in page. Never commit or upload the `.local` folder.
- Product changes and demo orders are saved in `data/store.json`. Keep private backups of this folder. Refresh or focus the storefront to see dashboard changes from another tab.
- Stop the server with Ctrl+C. The VS Code launch configuration also starts the local server.

## Deploy to Vercel

The project includes a Vercel Node function, route configuration and security headers. Import the GitHub repository into Vercel using **Other** as the framework. The output directory is `public`; the build command is `npm run check`. No framework dependency is required.

For a functional online CRM, connect an Upstash Redis database through the Vercel Marketplace and set these **server-side environment variables** in the project settings:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | A unique, randomly generated owner password of at least 16 characters. |
| `SESSION_SECRET` | An independent random signing secret of at least 32 characters. |
| `SITE_ORIGIN` | The canonical HTTPS URL, such as the actual project domain returned by Vercel. |
| `UPSTASH_REDIS_REST_URL` | The database HTTPS REST endpoint ending in `.upstash.io`. |
| `UPSTASH_REDIS_REST_TOKEN` | The private database REST token. |

Do not put these values in public JavaScript, GitHub, screenshots or chat. Redeploy after changing hosting variables. The Vercel-generated deployment and production URLs are also recognised. Add SITE_ORIGIN when using a custom domain. Use separate databases/secrets for preview and production when both permit editing.

Without the database, the hosted shop runs a read-only sample preview. Checkout shows an unsaved simulation and admin access stays disabled. Vercel functions cannot use this project's local JSON file for durable storage. No local orders or passwords are copied into deployments. The cloud catalogue starts from the tracked sample seed; replace those samples through the protected online dashboard once storage is connected.

## Validation and privacy

Run `npm run check` and `npm test`. See [SECURITY.md](SECURITY.md) for controls, verification and limitations.

The public API exposes catalogue information only. The demo never asks for personal contact or delivery details and never takes payment. Only product IDs and quantities are sent at checkout; fictional customer details are assigned on the server. Browser storage holds the toy bag only. Product images are public catalogue assets. Upload photos up to 2 MB; no remote image URLs are accepted. Fonts and artwork work offline.

The hosted CRM supports a small demonstration catalogue (up to 250 products and the latest 500 demo orders). Use appropriately sized product photos to stay within your database provider's payload/storage limits.

The contact information, shipping/return policies, real product specifications and safety/age information remain pending. This project is a working demo. Before real sales, implement a production order flow, payments, operational controls and final business details.

Provider references: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).
