# Phase 8: Coverage Targets

---

| Layer | Target | Rationale |
|-------|--------|-----------|
| **Repositories** | 90%+ | Critical data access layer; high impact bugs |
| **Services** | 85%+ | Business logic; test mocked Supabase |
| **`storageService`** | 85%+ | Upload failure + signed URL failure are critical paths for invoice upload |
| **API Routes** | 80%+ | Request/response handling; auth validation |
| **Cron route** (`/api/cron/process-invoices`) | 80%+ | `CRON_SECRET` header validation + batch processing loop |
| **Components** | 60%+ | UI interactions; avoid over-testing styling |
| **E2E** | 100% critical paths | Register, Login, Upload, Detail page access |

**Total project target**: 80% overall unit/integration, 50% components, 10% E2E coverage by time invested.
