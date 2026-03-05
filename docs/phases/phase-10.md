# Phase 10: Verification Checklist

## Goal
End-to-end verification across local dev, database, cron, auth/security, and production.

---

## Local Development

- [ ] `npm run dev` runs without errors
- [ ] `http://localhost:3000/login` renders login page
- [ ] `http://localhost:3000/register` renders registration page
- [ ] Register new user → redirects to dashboard
- [ ] Login existing user → redirects to dashboard
- [ ] Dashboard shows summary stat cards
- [ ] `/invoices` page loads with upload form
- [ ] Upload PDF/image → appears in list with `PENDING` status

---

## Database

- [ ] `npx prisma studio` shows `User` and `Invoice` tables
- [ ] New user registration creates entry in `users` table
- [ ] Upload creates entry in `invoices` table with `status = PENDING`
- [ ] `extractedData` field is null until cron runs

---

## Cron Processing (Local Test)

```bash
# Set CRON_SECRET locally
export CRON_SECRET="test-secret"

# Call the endpoint
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/process-invoices
```

- [ ] Response JSON shows `{ processed: N, results: [...] }`
- [ ] Invoice status changes from `PENDING` → `COMPLETED`
- [ ] `extractedData` populated with mock data (vendor, amount, date, lineItems)
- [ ] Invoice detail page shows extracted data

---

## Auth & Security

- [ ] Unauthenticated user accessing `/dashboard` redirects to `/login`
- [ ] Unauthenticated user accessing `/invoices` redirects to `/login`
- [ ] Unauthenticated `POST /api/invoices` returns 401
- [ ] Unauthenticated `GET /api/invoices` returns 401
- [ ] User A cannot see User B's invoices (test with two accounts)
- [ ] User A cannot access User B's uploaded files in Storage (signed URL check)
- [ ] `GET /api/invoices/[id]` returns 403 when userId doesn't match

---

## Vercel Deployment

- [ ] Deploy to Vercel successfully (no build errors)
- [ ] All 6 environment variables set correctly
- [ ] Cron job visible in Vercel dashboard under **Cron Jobs**
- [ ] Cron runs every 5 minutes (check logs)
- [ ] Login/register works on production URL
- [ ] Upload and cron processing work end-to-end on production

---

## Post-POC: Future Enhancements

1. **Real AI/OCR** — Replace mocked `processInvoice()` with OpenAI GPT-4o Vision or Google Document AI
2. **Webhook Notifications** — Email on processing complete/failed
3. **Audit Logging** — Track upload/processing events per user
4. **Role-Based Access** — Admin dashboard, team collaborators
5. **Retry Logic** — Exponential backoff for failed processing
6. **Rate Limiting** — Protect upload/cron endpoints
7. **Advanced Search** — Filter by vendor, amount, date range
8. **Batch Processing** — Parallel processing with timeout awareness
9. **Supabase Edge Functions** — Move processing out of Vercel for greater reliability
10. **Database Replication** — Multi-region for high availability
