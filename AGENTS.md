# Recuento CREUP — Agent Instructions

## Project Overview

Repository contains the real-time voting results viewer for **CREUP** assemblies.

Goals:

- Public page for viewing live and historical assembly voting results.
- Admin panel to manage events, votes, and vote options with real-time counting.
- Spanish-first localization strategy, with English (en-GB) as secondary language.
- No SEO — the site must not be indexed by search engines.

Current admin scope: events (name, dates, banner, visibility), votes (open/close, visibility), vote options (label, color, count, keyboard shortcut).

---

## Tech Stack

- **Framework:** Nuxt 4 + Nitro server routes
- **UI:** Nuxt UI v4 + Tailwind CSS 4
- **i18n:** `@nuxtjs/i18n` (JSON message files)
- **Image optimization:** `@nuxt/image`
- **Accessibility:** `@nuxt/a11y`
- **Database:** PostgreSQL + Drizzle ORM
- **Auth (admin):** `better-auth` (Google OAuth), backed by Drizzle
- **Real-time:** Server-Sent Events (SSE) via in-process EventEmitter
- **Icons:** `@iconify-json/tabler` (default), `@iconify-json/circle-flags`, `@iconify-json/lucide`
- **Analytics:** `nuxt-umami`

---

## Repository Structure

```
app/
  components/       Vue components (AppHeader, EventCard, VoteChart, etc.)
  composables/      Shared Vue composables (useAuth, useVoteStream, useCountUp, etc.)
  pages/            Route pages (public: events/, votes/; admin: admin/)
  layouts/          default.vue + admin.vue
  middleware/       admin-auth.global.ts
server/
  api/              Nitro route handlers (admin/** protected, public routes, SSE)
  handlers/         admin-auth.ts (global admin middleware)
  routes/           Non-API server routes (auth, health)
  utils/            All server helpers (auth, logger, sseManager, adminAccess, etc.)
  db/               schema.ts, index.ts (Drizzle client)
shared/
  utils/            config.ts
  constants/        locales.ts, adminRoutes.ts
i18n/locales/       es.json, en.json
drizzle/            Migrations
ops/                migrate.mjs, start.mjs
deploy/             Deployment templates (NGINX)
docker-compose.production.example.yml
```

---

## Language & Content Rules

### Code vs UI Text

- **All code and code comments MUST be written in English**.
- **Admin UI text MUST be Spanish** — admin pages, layouts, components, admin-facing API error messages.

### Public Site i18n

- All public user-facing text MUST go through Nuxt i18n.
- Supported locales: **`es`** (default, fallback) and **`en`** (en-GB, secondary).
- When locale-specific resource is missing, fall back to Spanish.

---

## Server/API Conventions

### Route Handler Size

`server/api/**` files should primarily: parse params, validate input (Zod), enforce auth if needed, call DB query, return JSON payload. If handler exceeds ~50 lines, extract to `server/utils/`.

### Response Envelopes

- Use `{ data }` for single resources and `{ data, meta }` for lists or paginated results.

### Admin Auth

- `/api/admin/**` protected globally by `server/handlers/admin-auth.ts` (configured in `nuxt.config.ts`).
- `requireAuth(event)` returns the verified session inside handlers.
- Session cached on `event.context.adminSession`.
- Authorization: `ADMIN_EMAILS` env var (comma/whitespace separated) always grants access.
- `/api/admin/session` returns `{ authenticated, envAdmin }` and should remain `Cache-Control: no-store`.

### SSE (Server-Sent Events)

- Real-time updates use the in-process EventEmitter in `server/utils/sseManager.ts`.
- Admin vote mutations (increment, decrement, set-count, open, close) emit events after DB write.
- The SSE endpoint at `/api/sse/votes` pushes updates to connected clients.
- Clients can filter by `?voteId=` query param.
- Heartbeat every 30s keeps connections alive.

### Error Handling

- Use `createError({ statusCode, message })` — never throw plain errors in handlers.
- Admin endpoint errors: Spanish strings are acceptable.

### Health Check

`GET /health` — checks DB connectivity. Returns `{ status: 'ok' | 'error', timestamp, checks }` with 200/503. Rejects requests with `X-Forwarded-For` header (404).

---

## Database & Drizzle

### Schema Conventions

- All tables use CUID2 as primary key (`text('id').primaryKey().$defaultFn(cuid)`).
- Timestamps use `timestamp(..., { withTimezone: true, mode: 'date' })`.
- `updatedAt` uses `.$onUpdate(() => sql\`now()\`)`.
- Use `date(...)` only for true date-only values.

### Migration Workflow

1. Edit `server/db/schema.ts`.
2. `pnpm db:generate` — creates migration file under `drizzle/`.
3. `pnpm db:migrate` — applies migrations via the project runner with advisory locking.

Never edit existing migration files.

---

## Frontend Composables — Use These, Do Not Reinvent

### useVoteStream

SSE composable for real-time vote updates. Auto-reconnects with exponential backoff.

### useCountUp

Smooth number animation using `requestAnimationFrame` with ease-out cubic easing.

### useActiveVote

Polls `/api/votes/active` every 5 seconds to detect open/closed votes.

### useAuth

Better Auth Vue client wrapper with `signInWithGoogle` and `signOut`.

### useLocaleFormatting

Locale-aware date and number formatting using `Intl.DateTimeFormat` and `Intl.NumberFormat`.

---

## Admin UI Patterns

### Form Mutations

```
submit → $fetch → on success: toast.add({ color: 'success' }) + refresh()
                on error: toast.add({ title: getApiErrorMessage(e, fallback), color: 'error' })
```

Never redirect from a modal form. Use `refresh()` instead.

### Vote Counting

- +1/-1 buttons per option with immediate DB update and SSE broadcast.
- Keyboard shortcuts: assign keys per option via the `shortcut` field.
- Set final count via direct input.

### Banner Upload

- Max 5 MB; accepted formats: jpg, jpeg, png, gif, webp, avif.
- Auto-resized to 1400×400px and converted to WebP.
- Stored in `public/banners/`.
- In production, persist banners via `APP_BANNERS_DIR` mounted to `/app/.output/public/banners`.

---

## Deployment Conventions

- Production deploys are local build + registry push + remote `docker compose`; no CI pipeline is required.
- `deploy.sh` expects Compose service names in `COMPOSE_APP_SERVICE` / `COMPOSE_POSTGRES_SERVICE`, not `container_name` values.
- `COMPOSE_POSTGRES_SERVICE` is optional when production uses an external PostgreSQL instance.
- NGINX must set `X-Forwarded-For` to `$remote_addr`, disable buffering for `/api/sse/`, and block `/health`.

---

## Engineering Principles

### Import Aliases

- Use `@/` for app-layer imports (`app/**`).
- Use `~~/` for root/shared imports (`shared/**`).

### Keep Related Files Updated

When you change code, review related files (AGENTS.md, README.md, i18n messages, migrations) and update them in the same task.

### Validation at Boundaries

Validate at the HTTP boundary (request body, query, params). Trust internal service calls after validation.

### Avoid Security Regressions

- Never expose raw stack traces or DB errors in API responses.
- All admin mutations require auth via global middleware.

---

## Commit Guidelines

Follow Conventional Commits:

```
feat: add keyboard shortcuts for vote counting
fix: correct SSE reconnection on error
refactor: extract vote chart component
```

---

## Pull Request Checklist

- Public UI text uses i18n.
- Admin UI text is Spanish.
- Spanish remains default and fallback locale.
- Admin auth relies on global middleware path.
- Skeleton loaders and error states present for async sections.
- Accessibility verified (semantic HTML, keyboard nav, `alt` text).
- Lint passes (`pnpm lint:fix`).
- If DB schema changed: migration generated and applied.
