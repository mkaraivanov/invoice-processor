# Test Automation Strategy — Overview

**Status**: Draft
**Last Updated**: March 3, 2026
**Approach**: Pragmatic TDD (tests alongside features)

---

## Executive Summary

Implement a three-tier testing pyramid using **Vitest** (unit + integration), **React Testing Library** (components), and **Playwright** (E2E). Use a real Postgres test database with transaction rollback for isolation, and a real Supabase test project with authentication fixtures. Tests and code develop in parallel. **Target coverage**: ~60% unit/integration, ~30% component, ~10% E2E.

| Layer | Tool | Coverage | Speed | Purpose |
|-------|------|----------|-------|---------|
| **Unit & Integration** | Vitest | 60% | ⚡ Fast | Services, repositories, API routes, utilities |
| **Component** | Vitest + RTL | 30% | ⚡ Fast | React components (Client Components only) |
| **End-to-End** | Playwright | 10% | 🐢 Slow | Critical user flows (auth, upload, processing) |

---

## Architecture Overview

```
tests/
├── unit/
│   ├── repositories/          # Prisma CRUD operations (real DB)
│   │   ├── user.repository.spec.ts
│   │   └── invoice.repository.spec.ts
│   ├── services/              # Business logic (mocked Supabase)
│   │   ├── auth.service.spec.ts
│   │   ├── invoice.service.spec.ts
│   │   └── storage.service.spec.ts
│   └── utils/                 # Utility functions
│       └── validation.spec.ts
├── integration/
│   └── api/                   # API Route Handlers (Next.js)
│       ├── invoices.spec.ts
│       ├── invoices-get.spec.ts
│       └── cron-process.spec.ts
├── components/                # React Component tests (jsdom)
│   ├── LoginPage.spec.tsx
│   ├── RegisterPage.spec.tsx
│   ├── InvoicesPage.spec.tsx
│   └── DashboardPage.spec.tsx
├── e2e/                       # End-to-End tests (real browser)
│   ├── auth.setup.ts          # Runs once: authenticates and saves playwright/.auth/user.json
│   ├── auth.spec.ts
│   ├── auth-login.spec.ts
│   ├── invoices-upload.spec.ts
│   ├── invoices-list.spec.ts
│   ├── auth-guard.spec.ts
│   └── ownership.spec.ts
├── fixtures/                  # Test helpers & mocks
│   ├── auth.fixture.ts
│   ├── db.fixture.ts
│   └── mocks/
│       ├── supabase.mock.ts
│       └── storage.mock.ts
├── setup.ts                   # Global setup: DB connection, transaction hooks
└── playwright.config.ts       # Playwright configuration
```

---

## Key Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Pragmatic TDD** | Tests alongside features = faster iteration while maintaining quality |
| **Real test Postgres** | Catches schema/constraint violations; transactions isolate tests |
| **Mock Supabase in unit tests** | Speeds up tests; integration tested via E2E |
| **Server Components via E2E only** | Avoids complexity of testing async RSC; verified through full request cycle |
| **Playwright + Vitest split** | Playwright for browser automation; Vitest for fast feedback loop |
| **GitHub Actions matrix** | Ensures compatibility across Node versions |
| **Playwright `setup` project for E2E auth** | Dedicated `auth.setup.ts` runs once before browser projects; session saved to `playwright/.auth/user.json`; avoids mid-test auth side-effects |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Tests hang on DB transaction** | Increase timeout in `vitest.config.ts`; check for unfinished queries |
| **Supabase mock not working** | Ensure `vi.mock()` is top-level in test file; check import path |
| **Playwright timeout** | Increase `timeout` in `playwright.config.ts`; check server logs |
| **Session state leak between tests** | Verify `afterEach` cleanup runs; check `vi.clearAllMocks()` |
| **Coverage not updating** | Delete `coverage/` folder; re-run with `--coverage` flag |

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing/)
- [Supabase Testing](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#testing)

---

## Phase Index

| File | Contents |
|------|----------|
| `phase_1_installation.md` | Install deps, vitest.config.ts, playwright.config.ts, setup.ts, .env.test, scripts |
| `phase_2_unit_integration_tests.md` | Repository tests, service tests, API route tests |
| `phase_3_component_tests.md` | LoginPage, DashboardPage component tests |
| `phase_4_e2e_tests.md` | auth.setup.ts, auth, invoice upload/list, ownership E2E tests |
| `phase_5_fixtures_helpers.md` | auth.fixture.ts, supabase.mock.ts, storage.mock.ts |
| `phase_6_cicd.md` | GitHub Actions workflow |
| `phase_7_development_workflow.md` | TDD cycle, local dev commands, debugging |
| `phase_8_coverage_targets.md` | Coverage targets per layer |
| `phase_9_verification_checklist.md` | Final checklist before shipping |
