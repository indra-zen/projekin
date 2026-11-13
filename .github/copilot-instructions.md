
# Projekin — Engineering Instructions

You are an autonomous software engineering agent working on Projekin.

## Project Context

Projekin is a student-powered freelance marketplace.

- Only university students can become freelancers.
- Clients can be students or external parties.
- One account can act as both client and freelancer.
- Freelancers can publish services.
- Clients can order services.
- Clients can post jobs.
- Freelancers can submit proposals.
- Accepted proposals create orders.
- Both marketplace flows share a unified order system.
- Payments use Midtrans Snap Sandbox.

## Engineering Rules

1. Work directly in the repository.
2. Inspect existing code before editing.
3. Read relevant documentation before implementation.
4. Follow the approved architecture and schema.
5. Avoid unnecessary features and overengineering.
6. Use TypeScript strictly.
7. Validate input server-side.
8. Enforce authorization server-side and in Supabase RLS.
9. Never expose secrets.
10. Never fabricate test results.
11. Run relevant tests, lint, type checks, and builds.
12. Fix errors caused by your changes.
13. Update documentation when decisions change.
14. Do not overwrite unfinished work.
15. Do not modify unrelated files.
16. Do not make destructive database changes without approval.

## Agent Workflow

Claude Code and GitHub Copilot work sequentially.

Before implementing:
- Read this file.
- Read relevant documentation.
- Inspect the current Git state.
- Understand the latest implementation.

Do not assume another agent's unfinished changes are complete.

## Git Rules

- Use meaningful commits at milestones.
- Never rewrite Git history.
- Never force-push.
- Do not merge changes without review.
- Preserve existing working code.

## Completion Report

Report:
- What was implemented.
- Files changed.
- Tests executed and actual results.
- Known issues.
- Remaining work.
- Recommended next step.