# Fraud Detection Issues - Fix Plan

## Overview

Code review identified issues between documented behavior and actual implementation.
This plan tracks fixes to align implementation with documentation.

## Branch Info

- **Worktree**: `/home/erfi/fraud-detection/forminator-fixes`
- **Branch**: `fix/fraud-detection-issues`
- **Base**: `main` @ `b6290fb`

---

## Critical Issues

### 1. Pre-validation Blacklist Cannot Check Ephemeral ID

**Status**: [ ] Not Started

**Location**: `src/routes/submissions.ts:178-184`

**Problem**:
```typescript
const blacklistCheck = await checkPreValidationBlock(
    null, // ephemeral_id not available yet - ALWAYS NULL
    metadata.remoteIp,
    metadata.ja4 ?? null,
    sanitized.email,
    db
);
```

Ephemeral ID is only available AFTER Turnstile validation, but pre-validation runs BEFORE.
The ephemeral_id blacklist check never fires on repeat visits.

**Impact**: Attackers blocked by ephemeral_id rules can bypass fast-path blacklist by changing IP/JA4.

**Fix Options**:
- A) Update documentation to reflect actual behavior (ephemeral_id checked post-validation only)
- B) Add second blacklist check after Turnstile validation specifically for ephemeral_id
- C) Store ephemeral_id in cookie/header for subsequent requests (changes architecture)

**Recommended**: Option B - Add post-validation ephemeral_id blacklist check

**Files to modify**:
- `src/routes/submissions.ts` - Add second check after line 255
- `docs/FRAUD-DETECTION.md` - Clarify Layer 0 behavior

---

### 2. IP Diversity Check Uses Wrong Data Source

**Status**: [ ] Not Started

**Location**: `src/lib/turnstile.ts:271-287`

**Problem**:
```typescript
const uniqueIps = await db
    .prepare(
        `SELECT COUNT(DISTINCT remote_ip) as count
         FROM submissions  // Only checks submissions table
         WHERE ephemeral_id = ?
```

Only queries `submissions` table, not `turnstile_validations`. Rapid proxy rotation attacks
that don't result in submissions won't be caught.

**Fix**:
- Add UNION with `turnstile_validations` table
- Match pattern used in `collectEphemeralIdSignals()` for consistency

**Files to modify**:
- `src/lib/turnstile.ts:271-287`

---

### 3. Risk Score Weights Don't Achieve 100% Without Token Replay

**Status**: [ ] Not Started

**Location**: `src/lib/scoring.ts`

**Problem**:
- Weights sum to 100% including token replay (28%)
- For non-replay scenarios, max possible score = 72%
- Block threshold is 70, dangerously close to max

**Fix Options**:
- A) Re-normalize weights when token replay is not a factor
- B) Lower block threshold to account for 72% max
- C) Document that 70 threshold effectively means "most signals firing"

**Recommended**: Option A - Dynamic weight normalization

**Files to modify**:
- `src/lib/scoring.ts` - Add weight normalization logic

---

## Medium Issues

### 4. Duplicate `toSQLiteDateTime()` Functions

**Status**: [ ] Not Started

**Problem**: Same helper defined 5 times across files.

**Files with duplicates**:
- `src/lib/turnstile.ts:156-160`
- `src/lib/fraud-prevalidation.ts:14-18`
- `src/lib/ja4-fraud-detection.ts:140-145`
- `src/routes/submissions.ts:37-42`
- `src/lib/ip-rate-limiting.ts:31-36`

**Fix**: Extract to shared utility file

**Files to modify**:
- Create `src/lib/utils/datetime.ts`
- Update all 5 files to import from shared location

---

### 5. Deprecated Functions Still Present

**Status**: [ ] Not Started

**Problem**: `checkEphemeralIdFraud()` and `checkJA4FraudPatterns()` marked deprecated but not removed.

**Files to modify**:
- `src/lib/turnstile.ts:335-539` - Remove or clearly mark dead code
- `src/lib/ja4-fraud-detection.ts:849-1043` - Remove or clearly mark dead code

---

### 6. IPv6 Subnet Matching Doesn't Handle Compression

**Status**: [ ] Not Started

**Location**: `src/lib/ja4-fraud-detection.ts:165-169`

**Problem**:
```typescript
const subnet1 = ip1.split(':').slice(0, 4).join(':');
```
Doesn't expand compressed IPv6 (`2001:db8::1` vs `2001:db8:0:0:0:0:0:1`).

**Fix**: Properly expand/normalize IPv6 before comparison

**Files to modify**:
- `src/lib/ja4-fraud-detection.ts:156-174`

---

## Minor Issues

### 7. Hardcoded Values Despite Config System

**Status**: [ ] Not Started

**Locations**:
- `src/lib/scoring.ts:313` - Ephemeral ID score values
- `src/lib/scoring.ts:179` - JA4 threshold 140
- `src/lib/ja4-fraud-detection.ts:460-480` - Score increments

**Fix**: Move to config system

---

## Progress Tracking

| Issue | Priority | Status | Commit |
|-------|----------|--------|--------|
| #1 Pre-validation ephemeral_id | Critical | [ ] | - |
| #2 IP diversity data source | Critical | [ ] | - |
| #3 Weight normalization | Critical | [ ] | - |
| #4 Duplicate datetime helper | Medium | [ ] | - |
| #5 Remove deprecated functions | Medium | [ ] | - |
| #6 IPv6 normalization | Medium | [ ] | - |
| #7 Hardcoded values | Minor | [ ] | - |

---

## Testing Plan

After fixes:
1. Run existing test suite: `npm test`
2. Verify pre-validation blacklist behavior manually
3. Test IPv6 subnet matching with compressed addresses
4. Verify risk scores can reach blocking threshold

---

## Notes

- Keep commits atomic (one issue per commit)
- Do not include co-author attribution in commits
- Update PLAN.md status after each fix
