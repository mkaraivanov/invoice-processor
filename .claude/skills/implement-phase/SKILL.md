---
name: implement-phase
description: Implement a numbered phase from docs/IMPLEMENTATION_PLAN.md
disable-model-invocation: true
argument-hint: "[phase-number]"
---
Read @docs/IMPLEMENTATION_PLAN.md, then implement Phase $ARGUMENTS step by step.

For each step in the phase:
1. Read relevant source files before making changes
2. Follow all rules in CLAUDE.md (Prisma import path, awaited cookies, auth in services)
3. Apply path-scoped rules automatically (.claude/rules/)
4. After completing all steps, run the Post-Implementation Checklist from CLAUDE.md
