# AGENTS.md

Guidance for AI coding agents working in this repository. Read CLAUDE.md for full project context.

## Project Summary

Full-stack Cloudflare Turnstile demo: Astro + React frontend, Cloudflare Workers (Hono) backend, D1 database, multi-layer fraud detection. ESM throughout (`"type": "module"`).

## Build & Development Commands

```bash
# Install dependencies (both root and frontend)
npm install && cd frontend && npm install && cd ..

# Local development (runs worker with remote D1)
wrangler dev --remote

# Frontend watch mode (separate terminal)
cd frontend && npm run dev

# Build frontend
npm run build

# Typecheck (root worker + frontend)
npm run typecheck        # runs: tsc --noEmit && cd frontend && npm run typecheck

# Deploy (typecheck + build + deploy)
npm run deploy

# Generate Cloudflare types
npm run cf-typegen
```

## Test Commands

Tests use Playwright with stealth plugin. Worker must be running first (`wrangler dev --remote`).

```bash
npm test                 # all tests (playwright test)
npm run test:basic       # form-submission + ephemeral-id specs
npm run test:fraud       # fraud-stress-test spec only
npm run test:headed      # all tests with visible browser
npm run test:fraud:headed # fraud tests with visible browser
npm run test:ui          # Playwright interactive UI mode

# Run a single test file
npx playwright test tests/form-submission.spec.ts

# Run a single test by name/grep
npx playwright test -g "test name pattern"

# Run with headed browser for debugging
npx playwright test tests/form-submission.spec.ts --headed
```

Test config: 90s timeout, chromium-stealth project, `fullyParallel: true`, baseURL defaults to `https://form.erfi.dev` (override with `TEST_URL` env var).

## Code Formatting

No ESLint. Formatting enforced by Prettier + EditorConfig.

**Prettier** (`.prettierrc`):

- Tabs for indentation (not spaces)
- Single quotes
- Semicolons always
- 140 char print width

**EditorConfig**: LF line endings, UTF-8, trim trailing whitespace, final newline.

## Code Style Guidelines

### Imports

1. Node built-ins first (`import { createHash } from 'node:crypto'`)
2. Third-party libraries (`import { Hono } from 'hono'`)
3. Framework sub-paths (`import { cors } from 'hono/cors'`)
4. Type-only imports on separate lines (`import type { Env } from '../lib/types'`)
5. Internal relative imports last

Always use named imports. Default imports only for `logger` and route handlers.
Use `import type` for type-only imports — never mix value and type imports in one statement.

### Naming Conventions

| Context                   | Convention                 | Examples                                   |
| ------------------------- | -------------------------- | ------------------------------------------ |
| Variables, functions      | camelCase                  | `tokenHash`, `calculateProgressiveTimeout` |
| Types, interfaces         | PascalCase                 | `RequestMetadata`, `FraudCheckResult`      |
| React components          | PascalCase                 | `SubmissionForm`, `AnalyticsDashboard`     |
| Constants                 | UPPER_SNAKE_CASE           | `DEFAULT_CONFIG`, `FORCE_BLOCK_TRIGGERS`   |
| DB columns, API responses | snake_case                 | `risk_score`, `bot_score`                  |
| TS interface fields       | camelCase                  | `riskScore`, `botScore`                    |
| Environment vars          | UPPER_SNAKE or UPPER-KEBAB | `ENVIRONMENT`, `X-API-KEY`                 |
| Backend files             | kebab-case                 | `fraud-prevalidation.ts`                   |
| React component files     | PascalCase                 | `SubmissionForm.tsx`                       |
| Hook files                | camelCase                  | `useAnalytics.ts`                          |

### TypeScript

- Strict mode enabled. Never use `any` without justification (some `Record<string, any>` for JSON metadata is acceptable).
- Use `interface` for object shapes, `type` for unions and `z.infer<>`.
- Explicit return types on exported functions. Implicit is fine for small internal helpers.
- `const` by default; `let` only when reassignment needed; never `var`.
- Use optional chaining (`cf?.country`) and nullish coalescing (`metadata.ja4 ?? null`).
- `null` for absent DB/API values; `undefined` for optional TS parameters.
- Backend uses Zod v3; frontend uses Zod v4. They have separate `validation.ts` files — do not share schemas across the boundary.

### Error Handling

Custom error hierarchy in `src/lib/errors.ts`:

- `AppError` (500) → `ValidationError` (400), `AuthError` (403), `RateLimitError` (429), `NotFoundError` (404), `ConflictError` (409), `ExternalServiceError` (503), `DatabaseError` (500)
- Route handlers: single `try/catch` wrapping entire handler, errors caught by `handleError(error, c)`.
- `throw` typed errors — never return raw status codes manually.
- Each error has a `userMessage` for client-facing responses.
- **Fail-open**: all signal collectors including token reuse check, email fraud detection, ephemeral ID signals, fraud block logging. The Turnstile API still validates tokens cryptographically; the replay check degrades gracefully during DB outages.

### Logging

Pino logger (`src/lib/logger.ts`). Always use structured format:

```typescript
logger.info({ submissionId, email, riskScore }, 'Submission created');
logger.warn({ reason, retryAfter }, 'Blacklist block triggered');
logger.error({ error: err.message, stack: err.stack }, 'Unexpected error');
```

### Functions & Patterns

- `async/await` everywhere — no `.then()` chains.
- `Promise.all` for parallel independent operations.
- `export function` preferred over `export const fn = () => {}`.
- JSDoc on exported functions (`@param`, `@returns`, `@see`).
- Section headers in long files: `// ========== SECTION NAME ==========`
- No barrel exports — import directly from each module's path.

### React (Frontend)

- Function components: `export default function ComponentName()`.
- Custom hooks prefixed with `use` in `frontend/src/hooks/`.
- React Hook Form + Zod resolver for form validation.
- shadcn/ui components in `frontend/src/components/ui/`.
- Local state only — no global state library.
- Lazy loading with `React.lazy()` + `Suspense` for dashboard sections.

### Hono (Backend)

- Each route file creates its own `new Hono<{ Bindings: Env }>()` instance.
- `src/index.ts` mounts sub-apps via dynamic routing.
- All DB queries live in `src/lib/database.ts` — routes never write SQL directly.
- Parameterized queries only — no string interpolation in SQL.

## Architecture Quick Reference

- **Worker entry**: `src/index.ts` (Hono app)
- **Routes**: `src/routes/` (submissions, analytics, config, geo)
- **Business logic**: `src/lib/` (turnstile, scoring, fraud detection, database)
- **Frontend**: `frontend/src/` (Astro pages, React components, hooks)
- **Schema**: `schema.sql` (4 tables: submissions, turnstile_validations, fraud_blacklist, fraud_blocks)
- **Config**: `wrangler.jsonc` (D1, service bindings, env vars, routes)
- **Fraud config**: Centralized in `src/lib/config.ts`, customizable via `FRAUD_CONFIG` env var

## Critical Rules

1. **Never split validation into separate endpoints** — token must be consumed atomically with submission creation.
2. **Check token reuse BEFORE calling Turnstile API** — saves API calls on replayed tokens.
3. **All fraud detection thresholds come from config** (`src/lib/config.ts`) — never hardcode threshold values.
4. **D1 is eventually consistent** — fraud detection is pattern-based and tolerates this.
5. **snake_case ↔ camelCase mapping** — DB columns are snake_case, TS interfaces are camelCase. `extractRequestMetadata()` does the translation.
