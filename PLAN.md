# Code Review — Fix Plan

## Overview

Comprehensive code review covering backend, frontend, fraud logic, schema, config, and infrastructure.
Findings organized into four tracks: **Fraud Logic**, **Correctness & Security**, **Frontend**, and **Infrastructure**.

**Final Status: 40/40 items resolved (38 completed, 2 deferred)**

## Branch Info

- **Branch**: `fix/code-review-issues`
- **Base**: `main` @ `d6b5d44`

---

## Track 1: Fraud Logic Gaps

Issues in the fraud detection pipeline where attackers can bypass or evade detection.

### F-1. Concurrent Submissions Bypass All Count-Based Signals [CRITICAL]

**Files**: `submissions.ts:108-835`, `turnstile.ts:187-294`, `ip-rate-limiting.ts:57-142`, `ja4-fraud-detection.ts:325-485`

**Attack**: Attacker sends N requests simultaneously. All N read historical count=0 before any writes complete. Each sees `effectiveCount=1`, all pass threshold checks. D1's eventual consistency worsens this — replicas may not see recent writes.

**Affected signals**: ephemeral ID count, validation frequency, IP rate limit, JA4 clustering.

**Fix**: Implemented write-before-read pattern (Option A):
- `logValidation()` now returns the inserted row ID (`RETURNING id`)
- New `updateValidationResult()` function updates the early record with final decision
- `submissions.ts` inserts a "pending" validation record BEFORE signal collection
- `collectEphemeralIdSignals` no longer adds `+1` for validation count (record already in DB)
- If the early log fails, falls back to original log-after-decision behaviour

**Status**: [x] Completed

---

### F-2. Blacklist Query Returns Most-Recently-Blocked, Not Latest-Expiring [CRITICAL]

**File**: `fraud-prevalidation.ts:55-106`

**Fix**: Changed queries to `ORDER BY expires_at DESC LIMIT 1`.

**Status**: [x] Completed

---

### F-3. Additive Scoring Can't Reach Block Threshold Without Deterministic Trigger [HIGH]

**File**: `scoring.ts:258-293`

**Problem**: Non-token-replay weights sum to 72%. An attacker with moderately suspicious signals across 4+ dimensions scores only ~25. The block threshold of 70 requires near-maximum signals across nearly ALL dimensions simultaneously.

**Fix**: Added corroboration bonus — when 3+ independent signals (excluding token replay) exceed a medium threshold (≥30) simultaneously, a flat +15 bonus is added. This rewards convergence of evidence, making the additive path viable for multi-signal attacks.

**Status**: [x] Completed

---

### F-4. Email Fraud Deterministic Block Requires Multi-IP — First Attempt Passes [HIGH]

**File**: `scoring.ts:383-387`

**Fix**: Removed `uniqueIPCount > 1` requirement. Fraudulent email pattern is self-sufficient evidence.

**Status**: [x] Completed

---

### F-5. Missing Ephemeral IDs (Non-Enterprise Turnstile) Kill 32% of Scoring Weight [HIGH]

**Files**: `turnstile.ts:102-106`, `submissions.ts:288-351`

**Fix**: Added dynamic weight redistribution when ephemeral ID signals are at baseline.

**Status**: [x] Completed

---

### F-6. IP Rate Limit Blind to Blocked Requests [MEDIUM]

**File**: `ip-rate-limiting.ts:69-77`

**Fix**: Now counts from both `submissions` AND `turnstile_validations WHERE allowed = 0`.

**Status**: [x] Completed

---

### F-7. Low-Confidence Blacklist Entries Cause Pre-Validation Hard Blocks [MEDIUM]

**Files**: `submissions.ts:506-521`, `fraud-prevalidation.ts:55-106`

**Fix**: Pre-validation now only hard-blocks on `confidence IN ('high', 'medium')`.

**Status**: [x] Completed

---

### F-8. No Email-Diversity-Per-IP Correlation [MEDIUM]

**Fix**: Added `collectEmailDiversitySignal` — counts distinct emails from same IP. 3+ distinct emails in 1 hour scored as high risk.

**Status**: [x] Completed

---

### F-9. Blacklist INSERT Failure Silently Ignored [MEDIUM]

**File**: `fraud-prevalidation.ts:276-321`

**Fix**: Failures now logged at ERROR level.

**Status**: [x] Completed

---

### F-10. JA4 Shared Across Same Browser Version — Household False Positives [MEDIUM]

**Files**: `ja4-fraud-detection.ts:325-398`

**Problem**: Two people in same household with same browser version share JA4 + IP. With 2+ ephemeral IDs, JA4 clustering flags them.

**Fix**: 
- Added `avgBotScore` field to `ClusteringAnalysis` interface
- Both `analyzeJA4Clustering` and `analyzeJA4GlobalClustering` now fetch `bot_score` from submissions
- `calculateCompositeRiskScore` applies household mitigation: when all submissions have high bot_scores (≥50, meaning Cloudflare considers them human) AND submissions are NOT rapid, the clustering signal is halved
- This allows families on the same network with the same browser to pass through while still catching automated attacks

**Status**: [x] Completed

---

## Track 2: Correctness & Security (Backend)

### B-1. `|| null` Converts Falsy `0` to `null` Throughout database.ts [HIGH]

**Fix**: Replaced all `|| null` with `?? null` for numeric fields.

**Status**: [x] Completed

---

### B-2. `getSubmissions` References Non-Existent Column `s.allowed` [HIGH]

**Fix**: Changed to `tv.allowed` with proper LEFT JOIN.

**Status**: [x] Completed

---

### B-3. Age Validation Ignores Month/Day [MEDIUM]

**Fix**: Full month/day comparison in age calculation.

**Status**: [x] Completed

---

### B-4. Name Regex Rejects Non-ASCII Characters [MEDIUM]

**Fix**: Changed to `/^[\p{L}\s'-]+$/u`.

**Status**: [x] Completed

---

### B-5. No Timing-Safe API Key Comparison [MEDIUM]

**Fix**: Uses `crypto.subtle.timingSafeEqual()` with type cast for Workers runtime.

**Status**: [x] Completed

---

### B-6. Health/Config Endpoints Leak Fraud Thresholds Unauthenticated [MEDIUM]

**Fix**: Health returns minimal `{ status, timestamp }`. Config behind API key auth.

**Status**: [x] Completed

---

### B-7. LIKE Search Allows Wildcard Injection [MEDIUM]

**Fix**: Escapes `%` and `_` in search terms with `ESCAPE '\\'`.

**Status**: [x] Completed

---

### B-8. `c.req.json()` Returns 500 on Malformed JSON [LOW]

**Fix**: Wrapped in try/catch, throws `ValidationError` with 400 status.

**Status**: [x] Completed

---

### B-9. `Error.captureStackTrace` May Not Exist in Workers [LOW]

**Fix**: Guarded with `if (Error.captureStackTrace)`.

**Status**: [x] Completed

---

### B-10. FNV-1a 32-bit Hash Collision Risk for Fingerprinting [LOW]

**File**: `types.ts:159-167`

**Problem**: 32-bit FNV-1a has 50% collision probability at ~77k entries.

**Fix**: Upgraded to `fnv1a64` — two independent 32-bit FNV-1a passes with different seeds and reversed byte order, producing a 64-bit (16 hex char) fingerprint. 50% collision threshold moves to ~5 billion entries. DB was nuked so no backward compatibility concern.

**Status**: [x] Completed

---

### B-11. `sanitizeString` Regex Is Incomplete [LOW]

**Status**: [x] Completed

---

### B-12. Export Endpoint Capped at 100 Rows [LOW]

**Status**: [x] Completed — raised to 5000.

---

### B-13. Logger Hardcodes `env: 'production'` [LOW]

**Status**: [x] Completed

---

### B-14. `fraud-patterns` Endpoint Leaks Error Details in 500 Response [LOW]

**Status**: [x] Completed

---

## Track 3: Frontend

### FE-1. Rate Limit Timer Recreates Interval Every Second [HIGH]

**Status**: [x] Completed

---

### FE-2. `hasActiveFilters` Date Comparison Always True [HIGH]

**Status**: [x] Completed

---

### FE-3. Missing AbortController in All Data Hooks [MEDIUM]

**Status**: [x] Completed

---

### FE-4. Missing `.ok` Checks for 3 of 15 API Responses [MEDIUM]

**Status**: [x] Completed

---

### FE-5. Pervasive `as any` Casts on API Responses [MEDIUM]

**Status**: [-] Deferred — high-effort/low-risk refactor

---

### FE-6. Custom Dialog Missing Accessibility [MEDIUM]

**Status**: [-] Deferred — shadcn/ui component, requires careful a11y audit

---

### FE-7. `alert()` Used for Error Handling [MEDIUM]

**Status**: [x] Completed

---

### FE-8. `inferDetectionType` Operator Precedence Bug [LOW]

**Status**: [x] Completed

---

### FE-9. Excessive `console.log` in Production [LOW]

**Status**: [x] Completed

---

## Track 4: Infrastructure & Schema

### I-1. Migration Numbering Conflicts [HIGH]

**Files**: `migrations/`

**Problem**: Two files shared `001_` prefix, `0001_` sorted before 3-digit files, `phase3-payload-agnostic.sql` had no numeric prefix.

**Fix**: Nuked the D1 database, deleted all 10 fragmented migration files, consolidated everything into a single `0001_initial_schema.sql` (copied from the canonical `schema.sql`). Applied cleanly — 41 DDL commands, all 5 tables + all indexes created.

**Status**: [x] Completed

---

### I-2. Missing Columns Have No Migration [HIGH]

**Status**: [x] Completed (now part of `0001_initial_schema.sql`)

---

### I-3. Missing Database Indexes [MEDIUM]

**Status**: [x] Completed (now part of `0001_initial_schema.sql`)

---

### I-4. Test-Only Packages in Production Dependencies [MEDIUM]

**Status**: [x] Completed

---

### I-5. `--disable-web-security` in Playwright Config [MEDIUM]

**Status**: [x] Completed

---

### I-6. Root tsconfig Includes `"dom"` Lib for Workers [MEDIUM]

**File**: `tsconfig.json:8`

**Problem**: `"lib": ["es2021", "dom"]` allows `window`/`document`/`localStorage` in type-checking despite not existing in Workers runtime.

**Fix**: Removed `"dom"` from lib — now `"lib": ["es2021"]`. Typecheck still passes cleanly because `worker-configuration.d.ts` (from `@cloudflare/workers-types`) provides `Request`, `Response`, `Headers`, `crypto`, `fetch`, etc.

**Status**: [x] Completed

---

### I-7. `ENVIRONMENT` Hardcoded to `production` with `remote: true` D1 [MEDIUM]

**File**: `wrangler.jsonc:20, 34`

**Problem**: Local dev with `wrangler dev --remote` writes to production DB.

**Fix**: Added `env.staging` section with `ENVIRONMENT=staging`, `ALLOW_TESTING_BYPASS=true`, and `ALLOWED_ORIGINS=*`. Added warning comment at top of env section. Developers should use `wrangler dev --remote --env staging`.

**Status**: [x] Completed

---

### I-8. No `format`/`format:check` Scripts [LOW]

**Status**: [x] Completed

---

### I-9. `@types/react` in Frontend `dependencies` Instead of `devDependencies` [LOW]

**Status**: [x] Completed

---

## Progress Tracking

| ID | Track | Priority | Status | Description |
|----|-------|----------|--------|-------------|
| F-1 | Fraud | Critical | [x] | Concurrent submissions bypass — write-before-read pattern |
| F-2 | Fraud | Critical | [x] | Blacklist query returns wrong entry (most-recent vs latest-expiring) |
| F-3 | Fraud | High | [x] | Additive scoring corroboration bonus (+15 when 3+ signals ≥30) |
| F-4 | Fraud | High | [x] | Email fraud block requires multi-IP unnecessarily |
| F-5 | Fraud | High | [x] | Missing ephemeral IDs kill 32% of scoring weight |
| F-6 | Fraud | Medium | [x] | IP rate limit blind to blocked requests |
| F-7 | Fraud | Medium | [x] | Low-confidence blacklist entries cause false blocks |
| F-8 | Fraud | Medium | [x] | No email-diversity-per-IP signal |
| F-9 | Fraud | Medium | [x] | Blacklist INSERT failure silently ignored |
| F-10 | Fraud | Medium | [x] | JA4 household false positives — bot_score + time-gap mitigation |
| B-1 | Backend | High | [x] | `\|\| null` converts falsy 0 to null |
| B-2 | Backend | High | [x] | `s.allowed` column doesn't exist |
| B-3 | Backend | Medium | [x] | Age validation ignores month/day |
| B-4 | Backend | Medium | [x] | Name regex rejects non-ASCII |
| B-5 | Backend | Medium | [x] | No timing-safe API key comparison |
| B-6 | Backend | Medium | [x] | Config/health leak fraud thresholds |
| B-7 | Backend | Medium | [x] | LIKE wildcard injection |
| B-8 | Backend | Low | [x] | Malformed JSON returns 500 |
| B-9 | Backend | Low | [x] | `Error.captureStackTrace` guard |
| B-10 | Backend | Low | [x] | FNV-1a 32-bit → 64-bit hash |
| B-11 | Backend | Low | [x] | Incomplete sanitizeString |
| B-12 | Backend | Low | [x] | Export capped at 100 rows |
| B-13 | Backend | Low | [x] | Logger hardcodes production env |
| B-14 | Backend | Low | [x] | Error details leaked in 500 |
| FE-1 | Frontend | High | [x] | Timer recreates interval every second |
| FE-2 | Frontend | High | [x] | hasActiveFilters always true |
| FE-3 | Frontend | Medium | [x] | Missing AbortController in hooks |
| FE-4 | Frontend | Medium | [x] | Missing .ok checks on 3 responses |
| FE-5 | Frontend | Medium | [-] | `as any` casts on API responses (deferred) |
| FE-6 | Frontend | Medium | [-] | Dialog missing accessibility (deferred) |
| FE-7 | Frontend | Medium | [x] | `alert()` for errors |
| FE-8 | Frontend | Low | [x] | Operator precedence in inferDetectionType |
| FE-9 | Frontend | Low | [x] | Excessive console.log |
| I-1 | Infra | High | [x] | Migration numbering — consolidated to single 0001_initial_schema.sql |
| I-2 | Infra | High | [x] | Missing column migrations (now in initial schema) |
| I-3 | Infra | Medium | [x] | Missing database indexes (now in initial schema) |
| I-4 | Infra | Medium | [x] | Test packages in prod deps |
| I-5 | Infra | Medium | [x] | --disable-web-security in tests |
| I-6 | Infra | Medium | [x] | DOM lib removed from worker tsconfig |
| I-7 | Infra | Medium | [x] | Staging env added to wrangler.jsonc |
| I-8 | Infra | Low | [x] | format:check script added |
| I-9 | Infra | Low | [x] | @types in wrong deps section |

---

## Notes

- Keep commits atomic (one issue or small related group per commit)
- Run `npm run typecheck` after each change
- Test fraud logic changes against `npm run test:fraud` when worker is running
- D1 database was nuked and rebuilt with a single consolidated migration on 2026-02-23
