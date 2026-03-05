---
name: verify
description: Final pre-commit check: run type-check (npx tsc --noEmit), lint (npm run lint), and tests (npm test)
disable-model-invocation: true
---
Run the full pre-commit verification suite in sequence:

1. `npx tsc --noEmit` — fix any type errors before continuing
2. `npm run lint` — fix any lint errors before continuing
3. `npm test` — fix any test failures before continuing

Report results for each step. If any step fails, stop and fix before proceeding to the next.
Do not suppress errors or use `--force` flags.
