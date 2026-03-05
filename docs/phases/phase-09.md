# Phase 9: Configuration & Deployment

## Goal
Finalize Next.js config, verify all dependencies, and deploy to Vercel.

---

## 9.1 `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
}

module.exports = nextConfig
```

Allows the Next.js Image component to load images from Supabase Storage.

---

## 9.2 Verify all dependencies installed

```bash
npm install
```

Confirm the following are in `package.json`:
- `@supabase/supabase-js`
- `@supabase/ssr`
- `@prisma/client`
- `@prisma/adapter-pg`
- `zod`
- `lucide-react`
- `uuid`
- Dev: `prisma`, `@types/uuid`

---

## 9.3 Local pre-deployment check

```bash
npm run lint
npm run type-check
npm run build
```

All three must pass before deploying.

---

## 9.4 Deploy to Vercel

### Step 1: Commit and push to GitHub

```bash
git add .
git commit -m "feat: initial invoice processor POC"
git push origin main
```

### Step 2: Connect to Vercel

1. Visit [vercel.com](https://vercel.com)
2. Click **New Project**
3. Import the GitHub repo `mkaraivanov/invoice-processor`
4. Root directory: `.` (default)

### Step 3: Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase project settings |
| `DATABASE_URL` | pooled connection (port 6543), must include `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | direct connection (port 5432) — required at build time for migrations |
| `CRON_SECRET` | generate: `openssl rand -hex 32` |

### Step 3b: Set build command

In Vercel project settings → **General → Build & Development Settings**, override the build command:

```
prisma generate && prisma migrate deploy && next build
```

This ensures:
1. Prisma client is generated before the Next.js build
2. Pending migrations are applied to the production DB before the app starts
3. `DIRECT_URL` (port 5432) must be available at build time for `migrate deploy`

Without this, new migrations won't apply to production, causing runtime crashes.

### Step 4: Enable Cron

Vercel automatically reads `vercel.json` and enables `/api/cron/process-invoices`.
View cron runs in Vercel dashboard under **Cron Jobs**.

### Step 5: Deploy

Vercel auto-deploys on every push to `main`.
Verify deployment at `https://<project>.vercel.app`.

---

## Checklist
- [ ] `next.config.js` has Supabase Storage image remote pattern
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds locally
- [ ] Deployed to Vercel
- [ ] Build command set to `prisma generate && prisma migrate deploy && next build`
- [ ] All 6 environment variables set in Vercel (including `DIRECT_URL` for migrations)
- [ ] `DATABASE_URL` includes `?pgbouncer=true&connection_limit=1`
- [ ] Cron job visible in Vercel dashboard
- [ ] App accessible at production URL
