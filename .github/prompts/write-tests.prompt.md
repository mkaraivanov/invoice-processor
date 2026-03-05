---
mode: agent
description: Write Vitest tests for a specified file
---
Write Vitest tests for `${input:filePath}`.

Rules:
- Choose the correct Vitest project:
  - Pure logic → `unit` (no DB)
  - Repository or service with real DB → `integration` (transaction rollback in afterEach)
  - React component → `components` (jsdom)
- Output: `tests/<tier>/${input:filePath:basename}.spec.ts`
- Integration: use transaction rollback wrapper, do NOT mock the DB
- Run `npm test` after writing to confirm they pass

Refer to the testing instructions in `.github/instructions/testing.instructions.md`.
