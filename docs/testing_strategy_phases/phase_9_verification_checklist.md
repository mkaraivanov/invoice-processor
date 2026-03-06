# Phase 9: Verification Checklist

---

- [ ] `npm run test:vitest` passes with ≥80% coverage
- [ ] `npm run test:component` passes
- [ ] `npm run test:e2e` passes locally
- [ ] GitHub Actions workflow runs on PR, blocks merge on failure
- [ ] Playwright traces saved in CI artifacts on failure
- [ ] Test database resets cleanly between runs (each integration test cleans up via `deleteMany` in `beforeEach`)
- [ ] `npm run test:watch` works for interactive development
- [ ] Mocks are reset between tests (no state leaks)
- [ ] Mock modules match real interface signatures
- [ ] `invoiceRepository.claimForProcessing` stale-reclaim path is covered (PROCESSING invoice older than 5 min appears in `findPending` results)
- [ ] `processPendingInvoices` `maxElapsedMs` guard is covered (loop breaks before processing all invoices when elapsed > 8000ms)
- [ ] `storageService` upload failure and signed URL failure paths have unit tests
- [ ] Cron route `CRON_SECRET` header validation has an integration test
