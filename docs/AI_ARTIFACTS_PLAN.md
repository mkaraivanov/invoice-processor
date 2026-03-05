# AI Artifacts Plan for Invoice Processor

## Context
The project is greenfield — planning docs exist (`docs/IMPLEMENTATION_PLAN.md`, `docs/TESTING_STRATEGY.md`) but no code yet. The goal is to equip both Claude Code and GitHub Copilot with the context they need to navigate and implement this project correctly, avoiding common pitfalls (wrong Prisma import path, unawaited cookies(), etc.).

---

## Artifacts to Create

### 1. `CLAUDE.md` (project root)

The primary context file for Claude Code. **Keep it short** — bloated CLAUDE.md files cause Claude to ignore instructions. Only include things that would cause mistakes if omitted; defer detail to skills and imported docs.

Sections:

- **Stack**: Next.js 15 App Router, Supabase (Auth/Storage/Postgres), Prisma v6+, shadcn/ui, Vercel, npm
- **Architecture rules**: Repository pattern → Services layer → API routes/UI. Prisma bypasses RLS; enforce access control in services.
- **Critical Prisma patterns** (inline — most likely mistake):
  - Import: `@/app/generated/prisma/client` (**never** `@prisma/client`)
  - Driver adapter: `@prisma/adapter-pg` + `PrismaPg`; singleton in `src/lib/prisma.ts`
- **Critical Next.js 15 patterns** (inline): `cookies()` must be awaited; `params` typed as `Promise<{id: string}>` and awaited.
- **Critical Supabase SSR** (inline): `@supabase/ssr` only; `setAll` sets cookies on both request AND response.
- **Package manager**: npm only.
- **shadcn/ui**: `components.json` must include `"hooks": "@/hooks"`.
- **Imported docs** (use `@` syntax so Claude reads the actual files):
  ```
  See @docs/IMPLEMENTATION_PLAN.md for phases and architecture.
  See @docs/TESTING_STRATEGY.md for test setup and conventions.
  ```
- **Context7 MCP instruction** (to include): "Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask."
- **Git conventions**: Commit format `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci).
- **Context management**:
  - Use `/clear` between unrelated tasks
  - Use `/compact` after completing a full implementation phase
  - Use subagents for investigation to preserve main context

Testing tier details (Vitest projects, pool config, Playwright auth) belong in `docs/TESTING_STRATEGY.md` and the `write-tests` skill — not inline in CLAUDE.md.

---

### 2. Claude Code Skills (`.claude/skills/`)

Use the skills directory format (recommended over legacy `.claude/commands/`). Each skill lives in its own subdirectory with a `SKILL.md` file. All skill files require YAML frontmatter.

Skills that should only be triggered manually (side effects, multi-step workflows) must include `disable-model-invocation: true` so Claude never auto-invokes them.

| Skill | Path | Invocation | Purpose |
|---|---|---|---|
| `implement-phase` | `.claude/skills/implement-phase/SKILL.md` | User-only | Implement a numbered phase from `IMPLEMENTATION_PLAN.md` |
| `new-repository` | `.claude/skills/new-repository/SKILL.md` | User-only | Scaffold a new Prisma-backed repository (CRUD template) |
| `new-service` | `.claude/skills/new-service/SKILL.md` | User-only | Scaffold a new service class following project conventions |
| `write-tests` | `.claude/skills/write-tests/SKILL.md` | User-only | Write Vitest tests for a file, respecting the 3-project config |
| `write-e2e` | `.claude/skills/write-e2e/SKILL.md` | User-only | Write a Playwright E2E test using the project's `auth.setup.ts` pattern |
| `db-migrate` | `.claude/skills/db-migrate/SKILL.md` | User-only | Run `npx prisma migrate dev`, regenerate client, verify import paths |
| `code-review` | `.claude/skills/code-review/SKILL.md` | Both | Review changed code after completing a full feature or phase |
| `verify` | `.claude/skills/verify/SKILL.md` | User-only | Final pre-commit check: type-check, lint, and run tests |

#### Frontmatter requirements per skill

**`implement-phase`** — manual only, takes a phase number argument:
```yaml
---
name: implement-phase
description: Implement a numbered phase from docs/IMPLEMENTATION_PLAN.md
disable-model-invocation: true
argument-hint: "[phase-number]"
---
Read @docs/IMPLEMENTATION_PLAN.md, then implement Phase $ARGUMENTS step by step.
```

**`new-repository`** — manual only, takes a model name:
```yaml
---
name: new-repository
description: Scaffold a Prisma-backed repository for a given model
disable-model-invocation: true
argument-hint: "[ModelName]"
---
```

**`new-service`** — manual only, takes a domain name:
```yaml
---
name: new-service
description: Scaffold a service class for a given domain
disable-model-invocation: true
argument-hint: "[domain-name]"
---
```

**`write-tests`** — manual only (creates files; test tier and fixture choice require deliberate judgment):
```yaml
---
name: write-tests
description: Write Vitest tests for a specified file following the project's 3-project config
disable-model-invocation: true
argument-hint: "[file-path]"
---
```

**`db-migrate`** — manual only (runs DB migrations):
```yaml
---
name: db-migrate
description: Run prisma migrate dev, regenerate client to the correct output path, and verify import paths
disable-model-invocation: true
---
```

**`write-e2e`** — manual only (creates files; requires real environment setup and deliberate placement):
```yaml
---
name: write-e2e
description: Write a Playwright E2E test for a specified flow using the project's auth setup pattern
disable-model-invocation: true
argument-hint: "[flow-description]"
---
```

**`code-review`** — can be auto-invoked by Claude when relevant (read-only; invoke after completing a full feature or phase, not after individual file edits):
```yaml
---
name: code-review
description: Review changed code for correctness, security, and project conventions. Invoke after completing a full feature or implementation phase — not after individual file edits.
---
```

**`verify`** — manual only (runs full test suite; expensive and disruptive mid-task):
```yaml
---
name: verify
description: Final pre-commit check: run type-check (npx tsc --noEmit), lint (npm run lint), and tests (npm test)
disable-model-invocation: true
---
```

---

### 2a. Claude Code Rules (`.claude/rules/`)

Path-scoped rule files that Claude Code auto-injects based on the file being edited — the Claude-side equivalents of the Copilot `.github/instructions/` files. Each file uses `applyTo` glob frontmatter. Keep content concise; detailed examples belong in skills.

| Rule file | `applyTo` glob | Key content |
|---|---|---|
| `.claude/rules/repositories.md` | `src/repositories/**` | Prisma import path (`@/app/generated/prisma/client`), no business logic, constructor pattern |
| `.claude/rules/services.md` | `src/services/**` | Import repositories (not Prisma directly), enforce auth checks, use Zod for input validation |
| `.claude/rules/api-routes.md` | `src/app/api/**` | Next.js 15 Route Handler conventions, `await cookies()`, call service layer only |
| `.claude/rules/testing.md` | `tests/**` | 3-project Vitest config (`unit`/`integration`/`components`), Playwright `auth.setup.ts` pattern, transaction rollback for integration tests |

Example frontmatter for a rule file:
```markdown
---
applyTo: "src/repositories/**"
---
# Repository Rules
- Import: `@/app/generated/prisma/client` (never `@prisma/client`)
- Constructor: `constructor(private prisma: PrismaClient)`
- Return types: use generated Prisma types (e.g. `Prisma.InvoiceGetPayload<...>`)
- No business logic — data access only
```

---

### 3. Claude Code Hooks (`.claude/settings.json`)

Hook input arrives via stdin as JSON. The file path must be extracted with `jq`. No `PreCommit` event exists in Claude Code — pre-commit enforcement belongs in a git hook or CI script (see note below).

**`PostToolUse` — guard wrong Prisma import**
After every `Edit` or `Write` tool call, scan the edited file for the wrong import path:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=$(jq -r '.tool_input.file_path'); grep -n \"from '@prisma/client'\" \"$FILE\" && echo \"ERROR: Use @/app/generated/prisma/client instead\" || true"
          }
        ]
      }
    ]
  }
}
```

**`PostToolUse` — Next.js 15 cookies audit**
After Edit/Write, check the edited file for unawaited `cookies()` calls:
```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "FILE=$(jq -r '.tool_input.file_path'); grep -n \"cookies()\" \"$FILE\" 2>/dev/null | grep -v \"await\" && echo \"WARNING: cookies() must be awaited in Next.js 15\" || true"
    }
  ]
}
```

Both hooks surface output in the transcript so Claude self-corrects immediately.

**`PreToolUse` — block `.env` edits**
Prevents accidental edits to `.env` / `.env.local` files containing Supabase keys and DB URLs:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(echo '$CLAUDE_TOOL_INPUT' | jq -r '.file_path // .path // \"\"'); if echo \"$file\" | grep -qE '\\.env(\\..*)?$'; then echo \"Blocked: editing env files requires explicit permission\"; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

**`PostToolUse` — type-check on save**
After editing `.ts`/`.tsx` files, run `tsc --noEmit` to surface type errors immediately:
```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "file=$(echo '$CLAUDE_TOOL_INPUT' | jq -r '.file_path // \"\"'); if echo \"$file\" | grep -qE '\\.(ts|tsx)$'; then npx tsc --noEmit 2>&1 | head -20; fi"
    }
  ]
}
```

**`PreToolUse` — block dangerous git operations**
Intercepts all Bash calls and hard-blocks destructive git commands (exit 2). Claude must surface the blocked command and get explicit user approval before attempting anything else.

Operations blocked:
- `git push --force` / `git push -f` (any branch)
- `git push origin --delete <branch>` / `git push origin :<branch>` (remote branch deletion)
- `git reset --hard`
- `git branch -D` (force-delete local branch)

Force-push to `main`/`master` is always blocked with a dedicated error message, regardless of other instructions.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cmd=$(echo '$CLAUDE_TOOL_INPUT' | jq -r '.command // \"\"'); if echo \"$cmd\" | grep -qE 'git push.*(--force|-f)|git push.*--delete|git push.*:[^/]|git reset --hard|git branch -D'; then if echo \"$cmd\" | grep -qE '(main|master)'; then echo \"BLOCKED: Force-push to main/master is not allowed.\"; else echo \"BLOCKED: Dangerous git operation requires explicit user approval: $cmd\"; fi; exit 2; fi"
          }
        ]
      }
    ]
  }
}
```

**Bash permissions allowlist**
Add a `permissions.allow` block so Claude can run common commands without prompting on every invocation:
```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npx:*)",
      "Bash(git:*)",
      "Bash(curl:*)",
      "Bash(ls:*)",
      "Bash(grep:*)",
      "Bash(find:*)",
      "Bash(node:*)"
    ]
  }
}
```
Without this, Claude will prompt for approval on every `npm` or `git` call during implementation phases.

**Pre-commit linting (not a Claude Code hook)**
There is no `PreCommit` hook event in Claude Code. Wire type-check + lint via a standard git hook instead:
- Add to `package.json` scripts: `"pre-commit": "npm run type-check && npm run lint"`
- Install via husky or a plain `.git/hooks/pre-commit` script

---

### 3b. Claude Code Subagents (`.claude/agents/`)

Specialized agents invoked via the `Agent` tool for parallel or isolated review tasks.

#### `security-reviewer`
This app handles auth flows, multi-tenant invoice ownership, and file uploads — all high-risk areas. A dedicated reviewer catches issues before they land.

**File**: `.claude/agents/security-reviewer.md`

```markdown
---
name: security-reviewer
description: Reviews auth, file upload, and ownership enforcement code for security issues
---

You are a security code reviewer specializing in Next.js + Supabase applications.

When invoked, review the provided code for:
- Auth bypass risks (missing session checks in API routes/Server Components)
- Insecure direct object references (invoice ownership not verified before access)
- File upload risks (MIME type validation, path traversal, size limits)
- Supabase service role key exposure (must never reach the browser)
- Missing Zod validation on API route inputs
- RLS bypass — this app uses Prisma (bypasses RLS), so access control MUST be in the service layer

Output: bulleted list of findings with severity (Critical/High/Medium/Low) and specific file:line references.
```

---

### 4. GitHub Copilot Instructions

#### `.github/copilot-instructions.md` (global)
Mirror of key CLAUDE.md sections condensed for Copilot's instruction format:
- Stack, architecture overview
- Prisma import rule (critical — most likely mistake)
- Next.js 15 async patterns
- Supabase SSR `setAll` cookie pattern
- Repository pattern description
- npm only, test structure overview
- **Context7 MCP instruction**: "Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask."

#### `.github/instructions/repositories.instructions.md`
Applied via `applyTo: "src/repositories/**"`. Contains:
- Prisma import path
- Constructor pattern (`constructor(private prisma: PrismaClient)`)
- Return types using generated Prisma types
- No business logic — data access only

#### `.github/instructions/services.instructions.md`
Applied via `applyTo: "src/services/**"`. Contains:
- Import repositories (not Prisma directly)
- Where to enforce authorization checks
- Zod schema usage for input validation
- Service method signature conventions

#### `.github/instructions/api-routes.instructions.md`
Applied via `applyTo: "src/app/api/**"`. Contains:
- Next.js 15 Route Handler conventions
- `cookies()` must be awaited
- Use service layer (never repositories/Prisma directly)
- Error response format

#### `.github/instructions/testing.instructions.md`
Applied via `applyTo: "tests/**"`. Contains:
- Three Vitest project names (`unit`, `integration`, `components`)
- Pool and worker config reminder
- Playwright auth setup flow
- Transaction rollback pattern for integration tests

---

### 5. GitHub Copilot Prompt Files (`.github/prompts/`)

Reusable slash-prompts in Copilot Chat:

| Prompt | File | Use case |
|---|---|---|
| New Repository | `new-repository.prompt.md` | "Create a repository for [Model]" — outputs full CRUD class |
| New Service | `new-service.prompt.md` | "Create a service for [domain]" — outputs service with Zod + repo calls |
| Write Vitest Tests | `write-tests.prompt.md` | "Write tests for [file]" — unit or integration with correct project tag |
| Write E2E Test | `write-e2e.prompt.md` | "Write Playwright test for [flow]" — uses auth setup pattern |
| Implement Plan Phase | `implement-phase.prompt.md` | "Implement phase [N]" — reads IMPLEMENTATION_PLAN and implements step-by-step |

---

### 6. `.gitignore` Additions

- `playwright/.auth/user.json` — auth state file written by `auth.setup.ts` (currently missing — mentioned in TESTING_STRATEGY.md)
- `CLAUDE.local.md` — local Claude overrides not meant for team sharing
- `tasks/` — TaskCreate/TaskList scratch files generated during Claude Code sessions
- `.claude/worktrees/` — temporary git worktrees created by Claude agent isolation

---

## Summary: Files to Create/Modify

| File | Action |
|---|---|
| `CLAUDE.md` | Create |
| `.claude/skills/implement-phase/SKILL.md` | Create |
| `.claude/skills/new-repository/SKILL.md` | Create |
| `.claude/skills/new-service/SKILL.md` | Create |
| `.claude/skills/write-tests/SKILL.md` | Create |
| `.claude/skills/write-e2e/SKILL.md` | Create |
| `.claude/skills/db-migrate/SKILL.md` | Create |
| `.claude/skills/code-review/SKILL.md` | Create |
| `.claude/skills/verify/SKILL.md` | Create |
| `.claude/rules/repositories.md` | Create |
| `.claude/rules/services.md` | Create |
| `.claude/rules/api-routes.md` | Create |
| `.claude/rules/testing.md` | Create |
| `.claude/agents/security-reviewer.md` | Create |
| `.claude/settings.json` | Modify — add hooks + permissions allowlist (incl. `.env` block + type-check on save) |
| `.github/copilot-instructions.md` | Create |
| `.github/instructions/repositories.instructions.md` | Create |
| `.github/instructions/services.instructions.md` | Create |
| `.github/instructions/api-routes.instructions.md` | Create |
| `.github/instructions/testing.instructions.md` | Create |
| `.github/prompts/new-repository.prompt.md` | Create |
| `.github/prompts/new-service.prompt.md` | Create |
| `.github/prompts/write-tests.prompt.md` | Create |
| `.github/prompts/write-e2e.prompt.md` | Create |
| `.github/prompts/implement-phase.prompt.md` | Create |
| `.gitignore` | Modify — add playwright auth, CLAUDE.local.md, tasks/, .claude/worktrees/ |

---

## Verification
1. Open any file in `src/repositories/` (once created) in VS Code — Copilot should auto-apply repository instructions; Claude should auto-inject `.claude/rules/repositories.md`
2. Run `/new-repository InvoiceRepository` — should produce correct Prisma import path
3. Run `/implement-phase 1` — Claude should read `docs/IMPLEMENTATION_PLAN.md` Phase 1 and execute
4. Trigger PostToolUse hook by editing a file with `from '@prisma/client'` — hook should warn in transcript
5. Check `.github/copilot-instructions.md` is picked up via `@workspace` in Copilot Chat
6. Confirm `npm run build` runs without a confirmation prompt (permissions allowlist working)
7. Run `/verify` — should execute `npx tsc --noEmit`, `npm run lint`, and `npm test` in sequence
