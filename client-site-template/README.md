# NGF Client Site Template

This is the standalone website template used by NGF Systems for client websites.

## How it works

The site fetches its content from the NGF Systems API, so all edits made in the
client portal are reflected here automatically on the next page load.

## Setup for a new client

1. Copy this repo (or use it as a template)
2. Edit `index.html` and update the two config lines at the top of the `<script>`:

```js
const NGF_API = 'https://your-ngf-app.com';   // Your deployed NGF app URL
const CLIENT_ID = 'cmnt0455i0001fwfxn6d7yptm'; // Client's ID from the admin panel
```

3. Deploy to GitHub Pages, Vercel, Netlify, or any static host
4. Point the client's domain DNS at the deployed URL
5. Set `site_url` in the NGF admin panel to the client's domain

## How editing works

The client logs into the NGF client portal and goes to the **Website** tab.
They can click any text on the live preview to edit it inline. Changes are saved
to the NGF database and reflected on this site immediately on reload.

## Content fields

All content is managed via the NGF portal. Fields include:
- **Brand**: business name, tagline, primary/secondary colors
- **Hero**: headline, subheadline, CTA button text & link
- **About**: title & body text
- **Services**: list of service cards (title + description)
- **Contact**: phone, email, address, hours
- **SEO**: meta title & description
