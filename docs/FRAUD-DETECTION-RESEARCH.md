# Ephemeral ID Fraud Detection - Complete Research & Implementation Guide

**Date:** 2025-11-13
**Status:** Research Complete, Ready for Implementation
**Sources:** 23 Cloudflare Documentation Files + Current Codebase Analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Reference](#quick-reference)
3. [Current Implementation Analysis](#current-implementation-analysis)
4. [Key Research Findings](#key-research-findings)
5. [Sophisticated Attack Patterns](#sophisticated-attack-patterns)
6. [5-Layer Detection Strategy](#5-layer-detection-strategy)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Success Metrics](#success-metrics)
9. [Documentation Sources](#documentation-sources)

---

## Executive Summary

### TL;DR

Ephemeral IDs excel at detecting pattern-based abuse but require multi-layered validation to catch sophisticated attackers using:
- Residential proxies (IP rotation)
- Real browser automation (valid bot scores)
- Manual solving services (valid tokens)
- Distributed attacks (multiple ephemeral IDs)

### Most Impactful Enhancements (Priority Order)

| Enhancement | Effort | Impact | Requirements |
|-------------|--------|--------|--------------|
| Form field fingerprinting | 2-3 hours | HIGH | Current data only |
| Velocity weighting | 1 hour | HIGH | Current schema |
| Geographic velocity | 2-3 hours | MEDIUM | GeoIP integration |
| Risk score expansion | 2-3 hours | MEDIUM | Threshold tuning |
| JA4 correlation | 1 day | VERY HIGH | Enterprise Bot Management |

---

## Quick Reference

### Ephemeral ID Fundamentals

**What are they?**
- Unique, short-lived identifiers (lifespan: up to a few days)
- Generated per visitor per Cloudflare customer
- Cookie-free, stateless tracking
- Detect abuse patterns across distributed attacks (IP rotation)

**Strengths:**
- ✅ Better than IP-only detection
- ✅ 7-day tracking window
- ✅ Works with privacy-focused users
- ✅ Detects IP rotation attacks

**Limitations:**
- ❌ Simple threshold detection misses sophisticated attacks
- ❌ No behavioral anomaly detection (current implementation)
- ❌ No fingerprinting correlation
- ❌ No geographic analysis
- ❌ No velocity weighting

**Availability:**
- Requires Enterprise Bot Management + Enterprise Turnstile, OR
- Standalone Enterprise Turnstile customers
- Must be enabled per-widget via API

### Critical Detection IDs

From Cloudflare Bot Management:

| ID | Description | Impact |
|----|-------------|--------|
| 50331648 | Scraping by ASN | Dynamic score re-calculation |
| 50331649 | Scraping by JA4 | Dynamic score re-calculation |
| 50331651 | Residential proxy | Sets bot score to 29 |

---

## Current Implementation Analysis

### Location
`src/lib/turnstile.ts:122-265`

### Ephemeral ID-Based Detection

```
7-day window checks:
- 5+ submissions → +30 risk
- 10+ submissions → +40 risk
- 10+ validations in 1 hour → +25 risk
- Block threshold: 70 risk score
```

### IP Fallback (When Ephemeral ID Unavailable)

```
1-hour window checks:
- 3+ submissions → +40 risk
- 5+ submissions → +30 risk
- Block threshold: 70 risk score
```

### Implementation Gaps

1. ❌ **Simple threshold detection** - No behavioral anomaly detection
2. ❌ **No fingerprinting** - Cannot correlate requests across IP rotations
3. ❌ **No geographic analysis** - Misses impossible travel patterns
4. ❌ **No velocity weighting** - Treats first and last submission equally
5. ❌ **No device intelligence** - Cannot detect headless browsers
6. ❌ **Limited context** - No form field value analysis (duplicate emails, etc.)

---

## Key Research Findings

### Top 5 Fraud Detection Signals

#### 1. JA4 Fingerprinting (Enterprise) - VERY HIGH IMPACT
- TLS profile consistency across IP rotations
- Identify bot networks and residential proxies
- Provides behavioral signals: request patterns, cache ratios
- **Detection:** Residential proxy detection (ID 50331651)

#### 2. Form Field Fingerprinting (Now) - HIGH IMPACT
- Email/phone pattern clustering
- Detect repeated attempts with variations
- **Effort:** 2-3 hours | **Requirements:** Current data only

#### 3. Geographic Velocity (Now) - MEDIUM IMPACT
- Detect impossible travel patterns (e.g., US→China in 30 seconds)
- Identify data center vs residential IP patterns
- **Effort:** 2-3 hours | **Requirements:** GeoIP integration

#### 4. Velocity Weighting (Now) - HIGH IMPACT
- Recent submissions weighted 3x higher
- Distinguish acute attacks vs sustained fraud
- **Effort:** 1 hour | **Requirements:** Current schema

#### 5. Behavioral Sequence (Enterprise) - HIGH IMPACT
- Form interaction timing and order
- Detect headless browser automation
- **Requirements:** Fraud Detection subscription

### Cloudflare Bot Management Signals

**Bot Score Engine (1-99 scale):**

| Score Range | Category | Detection Source |
|-------------|----------|------------------|
| 1 | Automated | Heuristics engine (high confidence) |
| 2-29 | Likely Automated | Machine Learning engine |
| 30-99 | Likely Human | ML + behavioral signals |
| 0 | Not Computed | Cloudflare routing bypass |

**Detection Engines:**
1. **Heuristics** - Malicious fingerprint database (all plans)
2. **Machine Learning** - 40+ request features from Cloudflare network (Enterprise)
3. **Anomaly Detection** - Unsupervised learning baseline deviation (Enterprise)
4. **JavaScript Detections** - Headless browser & malicious fingerprints (all plans)

### JA4 Signals Intelligence

Advanced behavioral metrics available for each JA4 fingerprint:

```json
{
  "ratios": {
    "h2h3_ratio_1h": 0.98,        // HTTP/2 vs /3 preference
    "heuristic_ratio_1h": 0.0001,  // Heuristic match ratio
    "browser_ratio_1h": 0.936,     // Browser vs bot behavior
    "cache_ratio_1h": 0.189        // Caching behavior
  },
  "ranks": {
    "uas_rank_1h": 901,            // User agent popularity rank
    "paths_rank_1h": 655,          // Request path distribution
    "reqs_rank_1h": 850,           // Request volume rank
    "ips_rank_1h": 662             // IP diversity rank
  }
}
```

**Fraud Detection Applications:**
- Unusual `ips_quantile` (high diversity) → Proxy/distributed attack
- Low `browser_ratio` → Automated client spoofing real browser
- High `heuristic_ratio` → Known bot fingerprint
- Anomalous path patterns → Scraping or enumeration

---

## Sophisticated Attack Patterns

Research identified 4 distinct attacker profiles:

### 1. Residential Proxy Attacks - HIGH RISK
- **Signal:** Detection ID 50331651
- **Behavior:** IP rotation + consistent TLS fingerprint
- **Detection:** Correlate JA4 + ephemeral ID + form patterns
- **Why Dangerous:** Indicates attacker intentionally rotating IPs

### 2. Real Browser Automation - HIGH RISK
- **Tools:** Puppeteer, Playwright, Selenium
- **Behavior:** Valid bot scores (70-99) despite automation
- **Detection:** Sequence anomalies + timing patterns (< 500ms form completion)
- **Why Dangerous:** Bypasses traditional bot detection

### 3. Manual Solving Services - MEDIUM RISK
- **Services:** 2captcha, CAPTCHA solving farms
- **Behavior:** Valid tokens + rapid submission rate
- **Detection:** Rate patterns + form field entropy
- **Why Dangerous:** Human solvers provide valid challenges

### 4. Distributed Bot Networks - MEDIUM RISK
- **Behavior:** Multiple ephemeral IDs + same form payload
- **Detection:** Form field clustering + geographic analysis
- **Why Dangerous:** Distributed makes rate limiting ineffective

---

## 5-Layer Detection Strategy

### Layer 1: Ephemeral ID Pattern Analysis (CURRENT)

**Status:** IMPLEMENTED
**Enhancement Needed:** Add velocity weighting

```typescript
// Current: Simple threshold counting
if (submissionCount >= 10) risk += 40;

// Enhanced: Velocity weighting
const recentWeight = 3;  // Last 1 hour
const mediumWeight = 2;  // 1-24 hours
const oldWeight = 1;     // 1-7 days

weightedScore = (recent * recentWeight) + (medium * mediumWeight) + (old * oldWeight);
```

**Impact:** Distinguish acute attacks vs sustained fraud

### Layer 2: JA4 Fingerprint Correlation (ENTERPRISE)

**Status:** NOT STARTED
**Requirement:** Enterprise Bot Management

```typescript
// Track for each ephemeral ID
interface FingerprintAnalysis {
  primary_ja4: string;
  alternate_ja4s: string[];
  ja4_diversity_score: number;
}

// Detection logic
if (ja4_diversity_score > 3) {
  risk += 20;  // Device spoofing/network hopping
}

if (consistent_ja4 && changing_ips && detection_id === 50331651) {
  risk += 15;  // Residential proxy detected
}
```

**Impact:** Detect device spoofing, proxy networks, automated tools

### Layer 3: Geographic Anomaly Detection (NOW)

**Status:** PARTIAL - GeoIP captured, not analyzed
**Requirement:** Current data + great-circle distance calculation

```typescript
// Calculate impossible travel
function detectImpossibleTravel(
  submissions: Submission[]
): number {
  let risk = 0;

  for (let i = 1; i < submissions.length; i++) {
    const prev = submissions[i-1];
    const curr = submissions[i];

    const distance = greatCircleDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );

    const timeElapsed = (curr.created_at - prev.created_at) / 3600; // hours
    const maxPossibleSpeed = 1000; // km/h (airplane)

    if (distance > (maxPossibleSpeed * timeElapsed)) {
      risk += 30;  // Impossible travel
    }
  }

  return risk;
}
```

**Impact:** Catch multi-national attacks, identify data centers

### Layer 4: Form Field Entropy Analysis (NOW)

**Status:** PARTIAL - Emails logged, not analyzed
**Requirement:** Current data + pattern clustering

```typescript
// Email pattern analysis
function analyzeFormEntropy(
  ephemeralId: string,
  submissions: Submission[]
): number {
  let risk = 0;

  const emails = submissions.map(s => s.email);
  const phones = submissions.map(s => s.phone);

  // Same email, different names
  if (new Set(emails).size === 1 && new Set(submissions.map(s => s.first_name)).size > 1) {
    risk += 25;
  }

  // Similar emails (off-by-one typos)
  const similarityScore = calculateLevenshteinSimilarity(emails);
  if (similarityScore > 0.9) {
    risk += 20;
  }

  // Sequential phone numbers
  if (areSequential(phones)) {
    risk += 20;
  }

  return risk;
}
```

**Impact:** Identify repeated fraud attempts with variations

### Layer 5: Behavioral Sequence Validation (ENTERPRISE)

**Status:** NOT STARTED
**Requirement:** Fraud Detection subscription

```typescript
// Sequence rules
const rules = [
  {
    name: "form_completion_too_fast",
    condition: (seq) => seq.form_fill_time < 500, // milliseconds
    risk: 30
  },
  {
    name: "skipped_terms_of_service",
    condition: (seq) => !seq.previous_ops.includes('view_terms'),
    risk: 25
  },
  {
    name: "no_field_interactions",
    condition: (seq) => seq.field_focus_count === 0,
    risk: 25
  }
];
```

**Impact:** Detect headless browser automation despite valid bot scores

---

## Implementation Roadmap

### Phase 1: Quick Wins (2-3 days) - RECOMMENDED IMMEDIATE

**Goal:** Enhance current ephemeral ID detection with available data

1. **Velocity Weighting** (1 hour)
   - Adjust risk scoring for recent activity
   - Recent = 3x weight, Medium = 2x, Old = 1x

2. **Form Field Fingerprinting** (2-3 hours)
   - Track email/phone patterns per ephemeral ID
   - Implement Levenshtein distance for similarity
   - Detect sequential patterns

3. **Geographic Velocity** (2-3 hours)
   - Calculate great-circle distance between submissions
   - Detect impossible travel (speed > 1000 km/h)
   - Log country changes per ephemeral ID

4. **Risk Score Expansion** (2-3 hours)
   - Expand from binary (block/allow) to 0-100 scale
   - Tiered thresholds: 100+, 80-99, 60-79, 40-59, <40

### Phase 2: Advanced Signals (1 week)

**Goal:** Integrate bot management data for pattern correlation

1. **JA4 Correlation**
   - Analyze TLS profile consistency
   - Track JA4 diversity per ephemeral ID
   - Detect device spoofing

2. **Detection ID Integration**
   - Consume detection IDs: 50331648, 50331649, 50331651
   - Factor residential proxy detection into risk

3. **Bot Score Factoring**
   - Adjust fraud risk based on bot score (1-99)
   - Detect score manipulation attempts

4. **Analytics Dashboard Enhancements**
   - Fraud detection visualizations
   - Ephemeral ID frequency distribution
   - Geographic heatmap
   - Risk score histogram

### Phase 3: Enterprise Features (2 weeks)

**Goal:** Enable optional advanced detection for Enterprise customers

1. **Sequence Rules**
   - Implement behavioral sequencing
   - Track form interaction timing
   - Detect natural vs automated patterns

2. **Advanced Rate Limiting**
   - Custom counting by JA4 + ephemeral ID
   - Multi-tiered protection (soft → hard)
   - Exponential backoff

3. **Feedback Loop**
   - Create tooling to report false negatives
   - Document patterns current detection misses
   - Build custom WAF rules

4. **ML Model Preparation**
   - Prepare features for custom ML model
   - Track attributes: IPs, UAs, JA3 hashes, ASN
   - Retrain with feedback data

### Phase 4: Continuous Improvement (Ongoing)

**Goal:** Monitor and adapt detection strategy

1. **False Negative Tracking**
   - Catalog patterns current detection misses
   - Common false negatives: residential proxies, real browser automation

2. **Custom WAF Rules**
   - Deploy rules for observed patterns
   - Target specific attack vectors

3. **A/B Testing**
   - Test new risk thresholds against baseline
   - Measure false positive rate

4. **Documentation**
   - Maintain fraud patterns encyclopedia
   - Document new attack types

---

## Success Metrics

| Metric | Target | Current Status |
|--------|--------|----------------|
| **Precision** | < 5% false positives | Not measured |
| **Recall** | 80%+ bot catch rate | Not measured |
| **Coverage** | Non-Enterprise compatible | ✅ YES |
| **Performance** | < 100ms fraud check | ✅ < 50ms |

### Measurement Strategy

1. **False Positives:** Track legitimate users flagged incorrectly
2. **False Negatives:** Use feedback loop to identify missed attacks
3. **Performance:** Monitor database query times in analytics
4. **Coverage:** Ensure graceful degradation for non-Enterprise

---

## Documentation Sources

### Cloudflare Documentation (23 files reviewed)

**Turnstile:**
- `cf-docs/turnstile/additional-configuration/ephemeral-id/index.md`
- `cf-docs/turnstile/tutorials/integrating-turnstile-waf-and-bot-management/index.md`

**Bot Management (Core):**
- `cf-docs/bots/concepts/bot-score/index.md`
- `cf-docs/bots/concepts/bot-detection-engines/index.md`
- `cf-docs/bots/concepts/feedback-loop/index.md`

**Bot Management (Advanced):**
- `cf-docs/bots/additional-configurations/ja3-ja4-fingerprint/index.md`
- `cf-docs/bots/additional-configurations/detection-ids/index.md`
- `cf-docs/bots/additional-configurations/detection-ids/scraping-detections/index.md`
- `cf-docs/bots/additional-configurations/detection-ids/additional-detections/index.md`
- `cf-docs/bots/additional-configurations/sequence-rules/index.md`
- `cf-docs/bots/troubleshooting/false-positives/index.md`

**WAF & Rate Limiting:**
- `cf-docs/waf/rate-limiting-rules/index.md`
- `cf-docs/waf/rate-limiting-rules/best-practices/index.md`
- `cf-docs/waf/custom-rules/use-cases/index.md`

### Project Documentation

- `src/lib/turnstile.ts` - Current fraud detection implementation (265 lines)
- `docs/FRAUD-DETECTION.md` - Current fraud detection strategy
- `docs/SECURITY.md` - Security architecture overview
- `CLAUDE.md` - Project context and instructions

---

## Specific Code Recommendations

### 1. In `src/lib/turnstile.ts::checkEphemeralIdFraud()`

```typescript
// Add velocity weighting
function calculateWeightedScore(submissions: Submission[]): number {
  const now = Date.now();
  let weightedScore = 0;

  for (const sub of submissions) {
    const ageHours = (now - sub.created_at) / (1000 * 3600);

    if (ageHours < 1) {
      weightedScore += 3;  // Recent: 3x weight
    } else if (ageHours < 24) {
      weightedScore += 2;  // Medium: 2x weight
    } else {
      weightedScore += 1;  // Old: 1x weight
    }
  }

  return weightedScore;
}
```

### 2. In Database Schema

```sql
-- Add ephemeral_id-specific indexes
CREATE INDEX idx_ephemeral_id_created
ON submissions(ephemeral_id, created_at DESC);

-- Add fingerprint columns (optional, for Enterprise)
ALTER TABLE submissions
ADD COLUMN ja4_fingerprint TEXT,
ADD COLUMN ja4_signals JSON,
ADD COLUMN previous_ja4_fingerprints TEXT;
```

### 3. In Analytics Dashboard

```typescript
// Add fraud detection visualizations
interface FraudMetrics {
  ephemeral_id_frequency: Map<string, number>;
  geographic_heatmap: Array<{lat: number, lng: number, count: number}>;
  risk_score_distribution: Array<{range: string, count: number}>;
  top_flagged_patterns: Array<{type: string, pattern: string, count: number}>;
}
```

---

## Critical Constraints & Limitations

### Cloudflare Limitations

1. **D1 Eventual Consistency**
   - D1 is eventually consistent (reads after writes may be stale)
   - Pattern detection tolerates eventual consistency
   - For strict "max N per window": use Durable Objects

2. **Ephemeral ID Scope**
   - Resets per Cloudflare customer
   - Cannot correlate across different sites
   - Lifespan: "up to a few days" (not guaranteed)

3. **Rate Limiting Delays**
   - Not designed for precise request counting
   - Delay of "up to a few seconds" before counter updates
   - Excess requests may reach origin before blocking

### Enterprise Dependencies

- Bot scores: Enterprise only
- Ephemeral IDs: Enterprise only
- JA3/JA4: Enterprise only
- Sequence rules: Enterprise only

**Design Principle:** Graceful degradation for non-Enterprise customers

---

## Key Insights

### Most Valuable Findings

1. **Ephemeral IDs Alone Are NOT Sufficient**
   - Excel at pattern detection but miss sophisticated attacks
   - Combined with JA4 fingerprinting: exponentially more effective
   - Form field analysis catches what network signals miss

2. **Residential Proxies Are Explicit Threat Vector**
   - Cloudflare has dedicated detection (ID 50331651)
   - Indicates attacker intentionally rotating IPs
   - When combined with suspicious form data: HIGH confidence

3. **Behavioral Analysis Beats Static Rules**
   - Sequence timing + interaction patterns catch automation
   - Impossible travel catches distributed attacks
   - Form entropy catches repeated fraud attempts

4. **Layered Approach Is Essential**
   - No single signal is perfect predictor
   - Heuristics + ML + Anomaly Detection (Cloudflare approach)
   - Stacking signals dramatically improves accuracy

5. **False Negatives Inform Model**
   - Feedback loop helps improve detection
   - Track what current system misses
   - Common: residential proxies, real browser automation

---

## Next Steps

### Implementation Decision

Choose your approach:

1. **Quick Wins (Phase 1)** - 2-3 days
   - Form field fingerprinting
   - Velocity weighting
   - Geographic velocity
   - Risk score expansion

2. **Comprehensive (All Phases)** - 4 weeks
   - All Phase 1 enhancements
   - JA4 correlation
   - Detection ID integration
   - Analytics dashboard updates
   - Rate limiting improvements

3. **Enterprise-Focused** - Varies
   - Requires Enterprise Bot Management
   - Full JA4 signals intelligence
   - Sequence rules
   - Advanced rate limiting

### Testing Plan

1. Measure false positive rate on current traffic
2. Benchmark detection accuracy with known bot traffic
3. Monitor performance impact (target: < 100ms)
4. A/B test new thresholds vs baseline

---

**Document Status:** Research Complete, Ready for Implementation
**Last Updated:** 2025-11-13
**Next Action:** Choose implementation phase and begin coding
