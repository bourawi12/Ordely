# Ordely — settings and conventions

**This file is yours. `install.sh` never overwrites it, and `/ks-setup` is its only creator.**
`AGENTS.md` belongs to the method and is rebuilt on every update — write nothing there.

Every value below is read by the pipeline commands. One setting per line, `Name: value`, nothing
else on the line: a command reads the value as everything after the colon, trimmed. Change any of
them at any time.

**After changing anything here, rerun `install.sh`** — it reassembles `AGENTS.md` from the method's
rules plus this file, and `AGENTS.md` is what an agent loads automatically. Settings are also read
straight from here, so those take effect immediately; the conventions at the bottom only reach an
agent through `AGENTS.md`, and stay stale until you reinstall.

## Pipeline settings

```
Merge mode:        pr
Target branch:     main
Plan validation:   human
Ship confirmation: human
Story track:       auto
Flow threshold:    2
Design source:     internal
Design skill:      —
Design tool:       —
Test budget:       25
Verification mode: record
Full suite:        execute-end
E2E stage:         ship
E2E scope:         nominal
E2E browsers:      —
Build stage:       ship-if-route
Issue tracker:     github
Worktree root:     .worktrees/
```

| Setting | Accepted values |
| --- | --- |
| Merge mode | `local` (squash-merged locally, no review platform) · `pr` (a pull request against the target branch) |
| Plan validation | `human` (a checkpoint blocks until you validate) · `autonomous` (the agent validates its own plan) |
| Ship confirmation | `human` (asked before any merge) · `automatic` |
| Design source | `internal` (the agent draws, using `Design skill`) · `external` (a brief goes to `Design tool`) |
| Story track | `auto` (the story's complexity picks the lane) · `full` (always the six-phase pipeline) · `flow` (always `/ks-flow`) |
| Flow threshold | complexity at or below which `auto` picks `/ks-flow` |
| Test budget | tests per story — a plan wanting more says why |
| Verification mode | `record` (the implementer records what it ran; the reviewer checks the record instead of re-running) · `rerun` (the reviewer runs everything itself) |
| Full suite | when the whole unit suite runs: `execute-end` · `ship` · `both` |
| E2E stage | when the end-to-end suite runs: `execute-end` · `ship` · `ci` · `—` |
| E2E scope | how far the end-to-end suite goes; `nominal` is one happy path |
| E2E browsers | browsers for the story cycle, e.g. `chromium`; `—` means the project's own default. Ship always runs them all |
| Build stage | when the production build runs: `ship-if-route` (only when a route or manifest moved) · `ship` · `review` · `ci` · `—` |

## Project commands

```
Package manager:   npm
Test:              cd backend && npm test
Typecheck:         —
E2E:               cd backend && npm run test:e2e
Build:             cd backend && npm run build && cd ../frontend && npm run build
```

A command left at `—` is one the agents cannot run: they say so rather than guess one.

## Project conventions

Stack and decisions: `docs/architecture.md`, ADRs in `docs/decisions/`.

### Backend (`backend/`, NestJS 10 + Prisma 6)
- One NestJS module per domain in `src/<domain>/`: `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `dto/`. Register new modules in `src/app.module.ts`.
- Controllers stay thin: validate with DTOs, call the service, return its result. Business logic lives in services.
- Every input goes through a class-validator DTO in `dto/` (the global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted`, `transform`). Trim strings with `@Transform`; phone numbers use the same `@Matches` rule as `create-order.dto.ts`.
- Numeric route params use `ParseIntPipe`. Errors are Nest exceptions (`NotFoundException`, `ConflictException`, `UnauthorizedException`…), never custom error payloads.
- Every route requires a JWT (global `AuthGuard`). Opt out only with `@Public()`, deliberately. Read the user with `@CurrentUser()`.
- Data access only through the injected `PrismaService`. Multi-row writes that must succeed together use `prisma.$transaction`.
- Schema changes = a Prisma migration in `prisma/migrations/` (with backfill when rows exist). Never `prisma migrate reset` on a database with data. Update `prisma/seed.ts` when the schema changes.
- Money is `Decimal(10, 3)` in TND. Dates are `timestamptz`; day boundaries use Africa/Tunis via `src/common/time.ts`.
- Env values are strings: convert numbers explicitly (`Number(config.get(...))`).
- Tests: unit `src/**/<name>.spec.ts` with Prisma mocked; e2e in `test/app.e2e-spec.ts` against `DATABASE_URL` (Postgres from `docker compose up -d db`). Style: Prettier (single quotes, trailing commas), `npm run lint`.

### Frontend (`frontend/`, Next.js 15 App Router)
- Route groups: `(marketing)` landing, `(auth)` login/register, `(app)` signed-in app under the `AppShell` layout. Signed-in routes are also listed in `src/middleware.ts` (cookie presence check).
- Pages are server components that read data through `src/lib/api.ts` (`server-only`). The browser never calls the API.
- Writes are server actions in an `actions.ts` next to the route, used from client components with `useActionState`. Catch blocks call `unstable_rethrow(err)` first so redirects pass through; then `revalidatePath` the affected pages.
- Add every new endpoint to `api` in `src/lib/api.ts` with its TypeScript type.
- Styles: CSS Modules only, built from the tokens in `src/app/globals.css` (they cover dark mode). App building blocks come from `src/components/app/ui.module.css` (card, table, badge, btn, input); icons from `src/components/Icon.tsx`. No Tailwind, no inline colors.
- Formatting (TND, durations, Tunis dates) goes through `src/lib/format.ts`. App copy is English; landing and auth pages are French.
- Never run `next build` in a directory where a `next dev` server is running (they share `.next/`).

### Git
- Commit messages: conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`) and a short imperative summary.
