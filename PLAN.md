# Code Review — Fix Plan

## Overview

Comprehensive code review covering backend, frontend, fraud logic, schema, config, and infrastructure.
Findings organized into four tracks: **Fraud Logic**, **Correctness & Security**, **Frontend**, and **Infrastructure**.

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

**Fix options**:
- A) Write validation record BEFORE signal collection, use `count >= threshold` instead of `count + 1 >= threshold`
- B) Use Durable Objects or KV atomic counters for rate tracking
- C) Add in-memory request deduplication within the Worker isolate (partial — doesn't cross isolates)

**Recommended**: Option A as minimum (cheapest), Option B for robustness.

**Status**: [ ] Pending — requires architectural change (Durable Objects or write-before-read)

---

### F-2. Blacklist Query Returns Most-Recently-Blocked, Not Latest-Expiring [CRITICAL]

**File**: `fraud-prevalidation.ts:55-106`

**Attack**: Attacker triggers a new low-confidence block (e.g., duplicate email → `confidence: 'low'`, 24h expiry). This new row shadows an older `confidence: 'high'` entry with a longer expiry. The `ORDER BY blocked_at DESC LIMIT 1` query returns the short-lived entry. Once it expires, the attacker is unblocked even though the longer entry is still active.

**Fix**: Change queries to `ORDER BY expires_at DESC LIMIT 1` to find the entry that expires latest, not the one blocked most recently.

**Status**: [x] Completed

---

### F-3. Additive Scoring Can't Reach Block Threshold Without Deterministic Trigger [HIGH]

**File**: `scoring.ts:258-293`

**Problem**: Non-token-replay weights sum to 72%. After renormalization (`/ 0.72`), every component at 100/100 reaches exactly 100. But practically, an attacker with moderately suspicious signals across 4+ dimensions (e.g., email=60, IP=50, JA4=40, fingerprint=30) scores only ~25. The block threshold of 70 requires near-maximum signals across nearly ALL dimensions simultaneously.

The system effectively requires a `blockTrigger` (deterministic) to block — the additive path alone is near-useless.

**Fix options**:
- A) Add a "corroboration bonus" when 3+ signals exceed a medium threshold (e.g., > 30) simultaneously
- B) Lower additive-only block threshold (e.g., 50 instead of 70)
- C) Add compound signals (see F-8)

**Status**: [ ] Pending

---

### F-4. Email Fraud Deterministic Block Requires Multi-IP — First Attempt Passes [HIGH]

**File**: `scoring.ts:383-387`

**Attack**: Single-IP attacker with clearly fraudulent email (markov-detected, score 100/100). `qualifiesForDeterministicBlock` for `email_fraud` requires `uniqueIPCount > 1`. A first-time attacker on one IP never satisfies this, scoring only `100 * 0.14 = 14` additive points (~19 after normalization). Well below 70.

**Fix**: Remove `uniqueIPCount > 1` requirement for email fraud deterministic blocks. A fraudulent email pattern is self-sufficient evidence.

**Status**: [x] Completed

---

### F-5. Missing Ephemeral IDs (Non-Enterprise Turnstile) Kill 32% of Scoring Weight [HIGH]

**Files**: `turnstile.ts:102-106`, `submissions.ts:288-351`

**Problem**: Without Enterprise Turnstile, `ephemeralId` is `null`. Silently disables ephemeral ID scoring (15%), validation frequency (10%), and IP diversity (7%). These default to baseline, meaning 32% of scoring weight is permanently minimized.

**Fix**: When ephemeral IDs unavailable, redistribute weight to remaining signals. Add a config flag for the Turnstile tier so scoring adapts automatically.

**Status**: [x] Completed

---

### F-6. IP Rate Limit Blind to Blocked Requests [MEDIUM]

**File**: `ip-rate-limiting.ts:69-77`

**Problem**: Counts only `FROM submissions`, but blocked requests never create submissions. An attacker blocked 100 times still shows IP count=0.

**Fix**: Count from both `submissions` AND `turnstile_validations` (like ephemeral ID signals already do for IP diversity).

**Status**: [x] Completed

---

### F-7. Low-Confidence Blacklist Entries Cause Pre-Validation Hard Blocks [MEDIUM]

**Files**: `submissions.ts:506-521`, `fraud-prevalidation.ts:55-106`

**Problem**: Duplicate email tracking inserts `confidence: 'low'` entries. Pre-validation doesn't filter by confidence — returns `blocked: true` for ANY active entry. A legitimate user who previously submitted a duplicate email is hard-blocked for 24h.

**Fix**: Pre-validation should only hard-block on `confidence: 'high'` or `confidence: 'medium'`. Low-confidence entries should be signal inputs only, or stored in a separate tracking table.

**Status**: [x] Completed

---

### F-8. No Email-Diversity-Per-IP Correlation [MEDIUM]

**Problem**: Attacker uses unique legitimate-looking emails from the same IP. Email fraud scores each individually (low risk). IP rate limiter sees moderate count. No signal checks "N distinct emails from same IP in time T" — a classic form-spam indicator.

**Fix**: Add a signal collector: `SELECT COUNT(DISTINCT email) FROM submissions WHERE remote_ip = ? AND created_at > ?`. Score ≥ 3 distinct emails per IP in 1 hour as high risk.

**Status**: [x] Completed

---

### F-9. Blacklist INSERT Failure Silently Ignored [MEDIUM]

**File**: `fraud-prevalidation.ts:276-321`

**Problem**: `addToBlacklist` catches all errors and returns `false`. Caller doesn't check return value. Attacker sees rate limit error for current request but is NOT recorded in blacklist — can retry immediately.

**Fix**: Log at ERROR level on failure. Caller should check return value and log if blacklist write fails.

**Status**: [x] Completed

---

### F-10. JA4 Shared Across Same Browser Version — Household False Positives [MEDIUM]

**Files**: `ja4-fraud-detection.ts:325-398`

**Problem**: Two people in same household with same browser version share JA4 + IP. With 2+ ephemeral IDs, JA4 clustering flags them. Doesn't trigger deterministic block (raw score ~80 < 140 threshold) but inflates risk and may cause blocks when combined with other signals.

**Fix**: Factor in Turnstile bot score — if both submissions have low bot scores (human-like), reduce JA4 clustering signal weight. Add time-gap awareness: submissions hours apart are less suspicious than seconds apart.

**Status**: [ ] Pending

---

## Track 2: Correctness & Security (Backend)

### B-1. `|| null` Converts Falsy `0` to `null` Throughout database.ts [HIGH]

**File**: `database.ts:137-138, 185, 311-312, 320-322`

**Problem**: `data.metadata.botScore || null` converts `0` to `null`. Score 0 means "definitely a bot" — the most critical value to preserve. Same issue with `clientTrustScore`, `riskScore`, `tldRiskScore`, `markovDetected`/`oodDetected`.

**Fix**: Replace all `|| null` with `?? null` for numeric fields. Fix `markovDetected`/`oodDetected` to guard with `emailFraudResult ? (signals.markovDetected ? 1 : 0) : null`.

**Status**: [x] Completed

---

### B-2. `getSubmissions` References Non-Existent Column `s.allowed` [HIGH]

**File**: `database.ts:507-508`

**Problem**: `submissions` table has no `allowed` column — it exists only on `turnstile_validations`. Query fails at runtime when filter is used. Count query also lacks the JOIN needed for this filter.

**Fix**: Change to `tv.allowed`. Add LEFT JOIN to count query when `allowed` filter is active.

**Status**: [x] Completed

---

### B-3. Age Validation Ignores Month/Day [MEDIUM]

**File**: `validation.ts:77-81`

**Problem**: Only compares years. Person born Dec 31, 2006 appears 18 on Jan 1, 2024 but is actually 17.

**Fix**: Account for month and day in age calculation.

**Status**: [x] Completed

---

### B-4. Name Regex Rejects Non-ASCII Characters [MEDIUM]

**File**: `validation.ts:41, 46`

**Problem**: `/^[a-zA-Z\s'-]+$/` blocks José, Müller, Børge, and all non-Latin names.

**Fix**: Use `/^[\p{L}\s'-]+$/u`.

**Status**: [x] Completed

---

### B-5. No Timing-Safe API Key Comparison [MEDIUM]

**Files**: `routes/analytics.ts:44`, `routes/submissions.ts:135`

**Fix**: Use `crypto.subtle.timingSafeEqual()` or `timingSafeEqual` from `node:crypto`.

**Status**: [x] Completed

---

### B-6. Health/Config Endpoints Leak Fraud Thresholds Unauthenticated [MEDIUM]

**Files**: `index.ts:110-121`, `routes/config.ts:19-20`

**Fix**: Only return `{ status: 'ok', timestamp }` on health. Move config details behind API key auth, or only expose values the frontend needs.

**Status**: [x] Completed

---

### B-7. LIKE Search Allows Wildcard Injection [MEDIUM]

**File**: `database.ts:513-514`

**Fix**: Escape `%` and `_` in search term, add `ESCAPE '\\'` to LIKE clauses.

**Status**: [x] Completed

---

### B-8. `c.req.json()` Returns 500 on Malformed JSON [LOW]

**File**: `routes/submissions.ts:151`

**Fix**: Wrap in try/catch, throw `ValidationError` with 400 status.

**Status**: [x] Completed

---

### B-9. `Error.captureStackTrace` May Not Exist in Workers [LOW]

**File**: `errors.ts:37`

**Fix**: Guard with `if (Error.captureStackTrace)`.

**Status**: [x] Completed

---

### B-10. FNV-1a 32-bit Hash Collision Risk for Fingerprinting [LOW]

**File**: `types.ts:159-167`

50% collision probability at ~77k entries. Use 64-bit hash or truncated SHA-256.

**Status**: [ ] Pending

---

### B-11. `sanitizeString` Regex Is Incomplete [LOW]

**File**: `validation.ts:90-95`

Strips `<tags>` but not partial tags, encoded entities, or `javascript:` URIs. Low risk since React auto-escapes, but fragile if data rendered in non-React context.

**Status**: [ ] Pending

---

### B-12. Export Endpoint Capped at 100 Rows [LOW]

**File**: `routes/analytics.ts:666-690`

`getSubmissions` defaults to `Math.min(limit || 50, 100)`. Export likely intends to return all matching rows.

**Status**: [ ] Pending

---

### B-13. Logger Hardcodes `env: 'production'` [LOW]

**File**: `logger.ts:8`

**Status**: [x] Completed

---

### B-14. `fraud-patterns` Endpoint Leaks Error Details in 500 Response [LOW]

**File**: `routes/analytics.ts:806` — `details: errorMessage` should be removed from client response.

**Status**: [x] Completed

---

## Track 3: Frontend

### FE-1. Rate Limit Timer Recreates Interval Every Second [HIGH]

**File**: `SubmissionForm.tsx:116-161`

**Problem**: `useEffect` depends on `[rateLimitInfo]`. `setRateLimitInfo` inside interval creates new object each tick, re-triggering the effect. Interval is torn down and recreated every second.

**Fix**: Store `expiresAt` in separate state or ref. Countdown updates `timeRemaining` without triggering the effect.

**Status**: [x] Completed

---

### FE-2. `hasActiveFilters` Date Comparison Always True [HIGH]

**File**: `AnalyticsDashboard.tsx:279-280`

**Problem**: Initial `dateRange.start` is `subDays(new Date(), 30)` (current time, not midnight), compared against midnight-normalized value. Always differs → badge always shows.

**Fix**: Initialize with `startOfDay(subDays(new Date(), 30))` and `endOfDay(new Date())`.

**Status**: [x] Completed

---

### FE-3. Missing AbortController in All Data Hooks [MEDIUM]

**Files**: `hooks/useAnalytics.ts`, `useSubmissions.tsx`, `useBlacklist.ts`, `useBlockedValidations.ts`

**Problem**: No fetch cancellation on unmount. Stale responses can overwrite current data. setState on unmounted component.

**Status**: [ ] Pending

---

### FE-4. Missing `.ok` Checks for 3 of 15 API Responses [MEDIUM]

**File**: `hooks/useAnalytics.ts:210-224`

`emailPatternsRes`, `blockedStatsRes`, `blockReasonsRes` not checked before `.json()`.

**Status**: [x] Completed

---

### FE-5. Pervasive `as any` Casts on API Responses [MEDIUM]

**Files**: All hooks

**Fix**: Define `ApiResponse<T>` type and use it instead of `(data as any).data`.

**Status**: [ ] Pending

---

### FE-6. Custom Dialog Missing Accessibility [MEDIUM]

**File**: `components/ui/dialog.tsx`

Missing `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape key handling.

**Status**: [ ] Pending

---

### FE-7. `alert()` Used for Error Handling [MEDIUM]

**Files**: `AnalyticsDashboard.tsx:154,179`, `SecurityEvents.tsx:414`

**Fix**: Use existing Alert component.

**Status**: [ ] Pending

---

### FE-8. `inferDetectionType` Operator Precedence Bug [LOW]

**File**: `SecurityEvents.tsx:745-748`

`reason.includes('validation')` without `&&` matches too broadly due to `&&`/`||` precedence.

**Status**: [ ] Pending

---

### FE-9. Excessive `console.log` in Production [LOW]

~25+ debug statements in `SubmissionForm.tsx` and `TurnstileWidget.tsx`.

**Status**: [ ] Pending

---

## Track 4: Infrastructure & Schema

### I-1. Migration Numbering Conflicts [HIGH]

**Files**: `migrations/`

- Two files share `001_` prefix
- `0001_` (4-digit) sorts before all 3-digit prefixed files
- `phase3-payload-agnostic.sql` has no numeric prefix

**Fix**: Renumber all migrations to a consistent scheme (e.g., `001` through `009`).

**Status**: [ ] Pending

---

### I-2. Missing Columns Have No Migration [HIGH]

**Files**: `schema.sql:42-46` vs `migrations/`

`email_risk_score`, `email_fraud_signals`, `email_pattern_type`, `email_markov_detected`, `email_ood_detected` exist in `schema.sql` but have no ALTER TABLE migration.

**Status**: [ ] Pending

---

### I-3. Missing Database Indexes [MEDIUM]

- `submissions(remote_ip, created_at)` — IP rate limiting queries
- `fraud_blacklist(blocked_at)` — recency queries
- `turnstile_validations(submission_id)` — LEFT JOIN foreign key
- `fraud_blocks(erfid)` — consistency with other tables

**Status**: [ ] Pending

---

### I-4. Test-Only Packages in Production Dependencies [MEDIUM]

**File**: `package.json:25-26`

Move `playwright-extra` and `puppeteer-extra-plugin-stealth` to `devDependencies`.

**Status**: [x] Completed

---

### I-5. `--disable-web-security` in Playwright Config [MEDIUM]

**File**: `playwright.config.ts:43`

Hides CORS bugs. Remove flag and test against proper CORS headers.

**Status**: [ ] Pending

---

### I-6. Root tsconfig Includes `"dom"` Lib for Workers [MEDIUM]

**File**: `tsconfig.json:8`

Allows `window`/`document`/`localStorage` in type-checking despite not existing at runtime.

**Status**: [ ] Pending

---

### I-7. `ENVIRONMENT` Hardcoded to `production` with `remote: true` D1 [MEDIUM]

**File**: `wrangler.jsonc:20, 34`

Local dev hits production database. Add environment-specific overrides.

**Status**: [ ] Pending

---

### I-8. No `format`/`format:check` Scripts [LOW]

**File**: `package.json`

Prettier not enforced in any script or CI. Add `format:check` to deploy chain.

**Status**: [x] Completed

---

### I-9. `@types/react` in Frontend `dependencies` Instead of `devDependencies` [LOW]

**File**: `frontend/package.json:20-21`

**Status**: [x] Completed

---

## Priority Order

**Phase 1 — Fraud logic correctness** (fixes that change blocking behavior):
F-1, F-2, F-4, B-1, B-2

**Phase 2 — Security hardening**:
B-5, B-6, B-7, F-7, F-9

**Phase 3 — Validation & data quality**:
B-3, B-4, B-8, B-9, F-3, F-5, F-6

**Phase 4 — Fraud detection improvements**:
F-8, F-10, F-3 (corroboration bonus)

**Phase 5 — Frontend reliability**:
FE-1, FE-2, FE-3, FE-4, FE-5

**Phase 6 — Infrastructure & cleanup**:
I-1 through I-9, B-10 through B-14, FE-6 through FE-9

---

## Progress Tracking

| ID | Track | Priority | Status | Description |
|----|-------|----------|--------|-------------|
| F-1 | Fraud | Critical | [ ] | Concurrent submissions bypass count-based signals |
| F-2 | Fraud | Critical | [x] | Blacklist query returns wrong entry (most-recent vs latest-expiring) |
| F-3 | Fraud | High | [ ] | Additive scoring can't reach block threshold alone |
| F-4 | Fraud | High | [x] | Email fraud block requires multi-IP unnecessarily |
| F-5 | Fraud | High | [x] | Missing ephemeral IDs kill 32% of scoring weight |
| F-6 | Fraud | Medium | [x] | IP rate limit blind to blocked requests |
| F-7 | Fraud | Medium | [x] | Low-confidence blacklist entries cause false blocks |
| F-8 | Fraud | Medium | [x] | No email-diversity-per-IP signal |
| F-9 | Fraud | Medium | [x] | Blacklist INSERT failure silently ignored |
| F-10 | Fraud | Medium | [ ] | JA4 household false positives |
| B-1 | Backend | High | [x] | `\|\| null` converts falsy 0 to null |
| B-2 | Backend | High | [x] | `s.allowed` column doesn't exist |
| B-3 | Backend | Medium | [x] | Age validation ignores month/day |
| B-4 | Backend | Medium | [x] | Name regex rejects non-ASCII |
| B-5 | Backend | Medium | [x] | No timing-safe API key comparison |
| B-6 | Backend | Medium | [x] | Config/health leak fraud thresholds |
| B-7 | Backend | Medium | [x] | LIKE wildcard injection |
| B-8 | Backend | Low | [x] | Malformed JSON returns 500 |
| B-9 | Backend | Low | [x] | `Error.captureStackTrace` guard |
| B-10 | Backend | Low | [ ] | FNV-1a 32-bit collision risk |
| B-11 | Backend | Low | [ ] | Incomplete sanitizeString |
| B-12 | Backend | Low | [ ] | Export capped at 100 rows |
| B-13 | Backend | Low | [x] | Logger hardcodes production env |
| B-14 | Backend | Low | [x] | Error details leaked in 500 |
| FE-1 | Frontend | High | [x] | Timer recreates interval every second |
| FE-2 | Frontend | High | [x] | hasActiveFilters always true |
| FE-3 | Frontend | Medium | [ ] | Missing AbortController in hooks |
| FE-4 | Frontend | Medium | [x] | Missing .ok checks on 3 responses |
| FE-5 | Frontend | Medium | [ ] | `as any` casts on API responses |
| FE-6 | Frontend | Medium | [ ] | Dialog missing accessibility |
| FE-7 | Frontend | Medium | [ ] | `alert()` for errors |
| FE-8 | Frontend | Low | [ ] | Operator precedence in inferDetectionType |
| FE-9 | Frontend | Low | [ ] | Excessive console.log |
| I-1 | Infra | High | [ ] | Migration numbering conflicts |
| I-2 | Infra | High | [ ] | Missing column migrations |
| I-3 | Infra | Medium | [ ] | Missing database indexes |
| I-4 | Infra | Medium | [x] | Test packages in prod deps |
| I-5 | Infra | Medium | [ ] | --disable-web-security in tests |
| I-6 | Infra | Medium | [ ] | DOM lib in worker tsconfig |
| I-7 | Infra | Medium | [ ] | Dev hits production DB |
| I-8 | Infra | Low | [x] | No format:check script |
| I-9 | Infra | Low | [x] | @types in wrong deps section |

---

## Notes

- Keep commits atomic (one issue or small related group per commit)
- Run `npm run typecheck` after each change
- Test fraud logic changes against `npm run test:fraud` when worker is running
- Update status in this file after each fix
