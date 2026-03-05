---
name: write-tests
description: Write Vitest tests for a specified file following the project's 3-project config
disable-model-invocation: true
argument-hint: "[file-path]"
---
Write Vitest tests for `$ARGUMENTS`.

First read @docs/TESTING_STRATEGY.md to understand the correct tier and fixture pattern.

Rules:
- Three Vitest projects: `unit` (node, no DB), `integration` (node, real DB with transaction rollback), `components` (jsdom)
- Choose the correct project based on what the file does:
  - Pure logic → `unit`
  - Repository or service with real DB → `integration`
  - React components → `components`
- Output file: `tests/<tier>/$ARGUMENTS.spec.ts` (mirror src/ structure)
- Integration tests must roll back DB changes in afterEach using a transaction wrapper
- Do NOT mock the DB in integration tests

After writing tests, run `npm test` to verify they pass.
