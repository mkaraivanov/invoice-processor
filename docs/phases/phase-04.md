# Phase 4: Supabase Setup

## Goal
Configure the Supabase project: retrieve credentials, sync the database schema, and set up the Storage bucket with RLS policies.

---

## 4.1 Create Supabase project

1. Visit [supabase.com](https://supabase.com)
2. Create a new project (note organization, project name, region)
3. Retrieve from **Project Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** (public, client-side) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** (secret, server-only) → `SUPABASE_SERVICE_ROLE_KEY`
4. Retrieve from **Settings → Database**:
   - **Pooled connection** (PgBouncer, port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DIRECT_URL`

Update `.env.local` with the retrieved values.

---

## 4.2 Sync Postgres schema from Prisma

The Prisma migration (Phase 3) creates tables in Supabase Postgres directly — no extra Supabase setup needed for tables.

If migration hasn't run yet against the real Supabase DB:

```bash
npx prisma migrate deploy
```

---

## 4.3 Create Storage bucket

1. Supabase dashboard → **Storage**
2. Click **Create Bucket** → name: `invoices`, **Private** (checked)
3. Click bucket → **Policies**
4. Add RLS policies:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Allow authenticated to upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own files
CREATE POLICY "Allow authenticated to read own invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

Files are stored as `{userId}/{uuid}.{ext}` — the RLS policy enforces per-user isolation.

---

## Checklist
- [ ] Supabase project created
- [ ] `.env.local` updated with real URL, anon key, service role key
- [ ] `DATABASE_URL` uses port 6543 (PgBouncer)
- [ ] `DIRECT_URL` uses port 5432 (direct connection)
- [ ] Prisma migration applied to Supabase Postgres
- [ ] `invoices` Storage bucket created (private)
- [ ] Upload RLS policy created
- [ ] Read RLS policy created
