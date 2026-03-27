# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GEACFO is a CFO platform (Spanish-language UI) built as a pnpm monorepo with Turborepo. It has three workspace packages:

- **`apps/web`** — Next.js 14 (App Router) frontend on port 3000
- **`apps/api`** — NestJS REST API on port 3001
- **`packages/database`** — Prisma ORM schema, seed data, shared PrismaClient

## Common Commands

```bash
# Install dependencies
pnpm install

# Start all services for development (web + api)
pnpm dev

# Database (requires PostgreSQL running — see docker compose below)
pnpm db:generate      # prisma generate
pnpm db:push          # prisma db push (sync schema without migrations)
pnpm db:migrate       # prisma migrate deploy
pnpm db:seed          # seed demo data (Grupo Ibérico SA tenant) — runs via npx tsx

# Build all packages
pnpm build

# Lint (no root ESLint config — each app has its own)
pnpm lint                            # lint all apps via turbo
pnpm --filter @geacfo/web lint       # runs: next lint
pnpm --filter @geacfo/api lint       # runs: eslint src --ext .ts

# Run only one app in dev
pnpm --filter @geacfo/web dev    # just the frontend
pnpm --filter @geacfo/api dev    # just the API

# Start PostgreSQL only
docker compose up postgres -d

# Production (all services via Docker)
docker compose up -d
```

There are no unit tests. `@nestjs/testing` is a devDependency but no unit test files or configs exist. There is no CI/CD pipeline (no `.github/workflows/`).

**E2E tests** exist using Playwright (`apps/web/e2e/`). Tests cover login, cockpit, pagos, usuarios, shortcuts, and hydration. Auth setup runs first, then Chromium tests reuse the stored auth state.

```bash
# E2E tests (requires dev server running on localhost:3000)
pnpm --filter @geacfo/web test:e2e        # headless Playwright
pnpm --filter @geacfo/web test:e2e:ui     # Playwright UI mode
```

**Engine requirements**: Node >= 18.0.0, pnpm 8.15.0 (enforced).

**Local dev gotchas**:
- Dev scripts load env vars via `export $(grep -v '^#' ../../.env | xargs)` — they don't use dotenv at runtime.
- `.env.example` uses `DATABASE_URL=...@localhost:5432/...` for local dev, but the checked-in `.env` uses `@postgres:5432` (Docker service name). When running `pnpm dev` outside Docker, use `localhost`.
- The checked-in `.env` has `NEXTAUTH_URL` and `NEXT_PUBLIC_API_URL` pointing to a production IP (`51.210.8.120`). For local dev, these should be `http://localhost:3000` and `http://localhost:3001`.
- CORS origin is set from `NEXTAUTH_URL`, so a mismatch will cause browser requests to fail.
- `next.config.js` has `allowedOrigins` for Server Actions hardcoded to `['localhost:3000', '51.210.8.120:3000']`.
- No Prisma migrations directory exists — the project uses `db push` exclusively (schema-first, no rollback history).

## Architecture

### Auth Flow
1. Login form calls `signIn('credentials', ...)` via NextAuth
2. NextAuth `CredentialsProvider.authorize` makes server-side `POST /api/v1/auth/login` to NestJS
3. NestJS validates with bcrypt, returns JWT containing `{ sub, tenantId, email, role }`
4. NextAuth stores the API's `access_token` in its own JWT cookie
5. Browser API calls attach `session.accessToken` as `Authorization: Bearer` header
6. NestJS `JwtAuthGuard` validates and sets `req.user = { userId, tenantId, email, role }`
7. All service methods scope DB queries by `tenantId` from the JWT

### Web → API Communication
Browser-side calls go through a **Next.js API proxy route** at `apps/web/src/app/api/v1/[...path]/route.ts`. The client in `apps/web/src/lib/api.ts` calls `/api/v1/...` on the same origin (relative path), which the proxy forwards to NestJS, injecting the Bearer token from the NextAuth JWT. The proxy uses `API_INTERNAL_URL` (Docker: `http://api:3001`) or falls back to `NEXT_PUBLIC_API_URL`. The `fetchAPI` helper auto-redirects to `/auth/login` on 401 responses. The proxy route uses `force-dynamic` (no caching).

API client namespaces: `api.auth` (login, me), `api.treasury` (cockpit, forecast, forecastCompare, cashflow, ratios, ar, ap, approveAP, accounts, reconciliation, autoMatch), `api.customers` (list, get, recalculate), `api.debt` (summary, instruments, covenants), `api.inventory` (list), `api.scenarios` (compare, simulate, variance), `api.bot` (chat, history, sessions), `api.alerts` (counts, notifications, resolutions, updateResolution), `api.board` (pack), `api.governance` (sources, audit), `api.import` (templates, movements, invoicesAR, invoicesAP, suppliers, debt, inventory), `api.users`, `api.settings`, `api.reporting`.

### API Structure
All API routes are prefixed with `/api/v1`. Global `ValidationPipe` with `transform: true, whitelist: true`. Swagger docs at `/api/docs`. Rate limit: 100 req/60s.

Modules: `auth`, `treasury`, `customers`, `debt`, `inventory`, `scenarios`, `bot`, `board`, `governance`, `alerts`, `users`, `settings`, `reporting`, `import`, `notifications`, `health`, `budget`, `provisions`, `suppliers`. Each module has its own controller, service, and module file. Each service instantiates `new PrismaClient()` directly (not using DI or the shared singleton from `@geacfo/database`).

Additional module notes:
- `health` — `GET /health` endpoint (skips rate limit), checks DB connectivity and reports memory/uptime. Used by Docker HEALTHCHECK and load balancers.
- `import` — Excel/CSV bulk import for bank movements, invoices AR/AP, suppliers, debt instruments, inventory. Has a stricter rate limit (10 req/min).
- `notifications` — WebSocket gateway (Socket.IO) on `/notifications` namespace. Uses `@nestjs/event-emitter` to broadcast real-time events (payment approved/rejected, invoice created, covenant risk, alert resolved) to connected clients scoped by tenant room.

Middleware stack: Helmet (security headers) and compression are enabled globally in `main.ts`. Global interceptors: `RequestLoggerInterceptor` (structured request logging) and `AuditInterceptor` (writes to `AuditLog` table). Auth uses two Passport guards: `LocalAuthGuard` (credentials login) and `JwtAuthGuard` (token validation on protected routes). Common infrastructure lives in `src/common/` — guards (`user-throttler.guard.ts`), interceptors, logger (`StructuredLogger`), and filters.

### Database
PostgreSQL 16 with Prisma. Multi-tenant design — almost every model has a `tenantId` FK to `Tenant`. All IDs use `cuid()`. Key enums: `Role` (ADMIN/CFO/CONTROLLER/ANALYST/VIEWER), `RiskLevel`, `InvoiceStatus`, `DebtType`, `SyncStatus`. Key models: `Tenant`, `User`, `Session`, `BankAccount`, `BankMovement`, `Reconciliation`, `Customer`, `ScoreHistory`, `InvoiceAR`, `Supplier`, `InvoiceAP`, `DebtInstrument`, `Covenant`, `InventoryItem`, `ForecastWeek`, `DataSource`, `AuditLog`, `BotMessage`, `AlertResolution`, `ReportSchedule`. `ForecastWeek` has a composite unique on `(tenantId, scenario, weekNumber)`.

### Frontend Structure
- Auth: NextAuth v4 with CredentialsProvider, configured in `src/lib/auth.ts`. Session maxAge: 7 days.
- State: Zustand store in `src/store/app.ts` (sidebar collapse state, persisted to localStorage)
- UI: Shadcn/ui components in `src/components/ui/`, Tailwind CSS with custom semantic tokens, dark mode default
- Charts: Recharts
- i18n: `next-intl` with locale files in `apps/web/messages/` (`es.json`, `en.json`). Default locale is `es`. Config in `src/i18n/config.ts`.
- Dashboard layout (`src/app/dashboard/layout.tsx`) is a server component that checks session and redirects to `/auth/login` if unauthenticated
- Dashboard routes use **Spanish names** (e.g., `deuda`, `cobros`, `pagos`, `conciliacion`, `gobierno`) while API modules use English (`debt`, `treasury`, `customers`, `governance`)
- Dashboard pages live under `src/app/dashboard/` — 28 routes total. Key route → API mapping: `cobros` → treasury/ar, `pagos` → treasury/ap, `deuda` → debt, `conciliacion` → treasury/reconciliation, `gobierno` → governance, `importar` → import, `proveedores` → suppliers, `notificaciones` → alerts, `usuarios` → users, `configuracion` → settings, `inventario`/`inventario-abc` → inventory, `presupuesto` → budget, `provisiones` → provisions, `proyeccion-diaria`/`vencimientos`/`ratios`/`cashflow` → treasury

### Bot CFO
`apps/api/src/bot/bot.service.ts` calls Anthropic API with `claude-sonnet-4-20250514`. The system prompt includes live financial data (cash positions, covenants, customer alerts) fetched from DB at request time.

## Key Config Notes

- **API tsconfig**: `strict: false`, `experimentalDecorators: true`, path alias `@geacfo/database` → `../../packages/database/src/index.ts`
- **Web tsconfig**: `strict: true`, path alias `@/*` → `./src/*`
- **next.config.js**: `output: 'standalone'`, `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`
- **Tailwind**: dark mode via `class`, custom colors (success/warning/gold), fonts: IBM Plex Sans, IBM Plex Mono, Syne
- **Docker**: node:20-alpine base images, both Dockerfiles run `prisma generate` during build. Web Dockerfile manually copies Prisma query engine binary into standalone output. No Redis service despite some code references to it.
- **NestJS logger**: Only `['error', 'warn', 'log']` levels enabled (no debug/verbose)
- **NestJS build output**: `dist/apps/api/src/main` (non-standard nested path due to monorepo tsconfig)
- **Turbo**: `.env` is a `globalDependency` in `turbo.json` — changes to `.env` invalidate all cached builds

## Demo Credentials
- Email: `ana.castro@grupoiberico.es`
- Password: `geacfo2026`
