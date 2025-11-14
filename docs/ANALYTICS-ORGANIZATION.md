# Analytics Dashboard Organization Analysis: Fraud Detection & Blocked Requests

## Executive Summary

The analytics dashboard currently has **4 sections showing blocked/mitigated data** with **significant redundancy and confused relationships**. This analysis identifies overlaps, clarifies data flow, and proposes a restructured approach.

**Key Finding**: The current sections conflate three distinct concepts:
1. **Detection events** (validation attempts that triggered fraud detection)
2. **Enforcement snapshots** (current active blocks from the blacklist cache)
3. **Analysis metrics** (aggregated statistics about blocks)

---

## Section 1: Current State Analysis

### Section A: BlockedStatsSection
**File**: `frontend/src/components/analytics/sections/BlockedStatsSection.tsx`  
**Data Source**: `useAnalytics` hook → `/api/analytics/blocked-stats` + `/api/analytics/block-reasons`  
**Database Query**: `turnstile_validations WHERE allowed = 0`

**What It Shows**:
- Card 1: Total blocked attempts (count)
- Card 2: Distinct ephemeral IDs involved in blocks
- Card 3: Distinct IPs used in blocks
- Card 4: Average risk score
- Card 2: Detailed breakdown of block reasons (type of fraud detected)

**Data Shape**:
```typescript
BlockedStats {
  total_blocked: number;           // Count of rows in turnstile_validations where allowed=0
  unique_ephemeral_ids: number;    // COUNT(DISTINCT ephemeral_id) from blocked rows
  unique_ips: number;              // COUNT(DISTINCT remote_ip) from blocked rows
  avg_risk_score: number;          // AVG(risk_score) from blocked rows
  unique_block_reasons: number;    // COUNT(DISTINCT block_reason) from blocked rows
}

BlockReason {
  block_reason: string;            // Categorical: "JA4 Session Hopping", "Ephemeral ID: Multiple submissions", etc.
  count: number;                   // How many times this specific block reason occurred
  unique_ephemeral_ids: number;    // Distinct ephemeral IDs for this reason
  unique_ips: number;              // Distinct IPs for this reason
  avg_risk_score: number;          // Average risk for this reason
}
```

**Insights Provided**:
- Historical overview of all blocks detected (ever)
- Categorization of why blocks happened
- Severity distribution (by risk score)

**API Endpoint**:
```typescript
GET /api/analytics/blocked-stats
GET /api/analytics/block-reasons
```

---

### Section B: BlacklistSection
**File**: `frontend/src/components/analytics/sections/BlacklistSection.tsx`  
**Data Source**: `useBlacklist` hook → `/api/analytics/blacklist`  
**Database Query**: `fraud_blacklist WHERE expires_at > datetime('now')`

**What It Shows**:
- List of **currently active** pre-validation blocks
- For each: ephemeral ID/IP, block reason, offense count, risk score, time until expiry
- Progressive timeout information (offense escalation)

**Data Shape**:
```typescript
BlacklistEntry {
  id: number;
  ephemeral_id: string | null;
  ip_address: string | null;
  block_reason: string;
  risk_score: number;              // Mapped from detection_confidence (high→100, medium→80, low→70)
  offense_count: number;           // Calculated: COUNT(*) from fraud_blacklist for this ID in last 24h
  blocked_at: string;
  expires_at: string;              // When the blacklist entry auto-expires
}
```

**Insights Provided**:
- Current active enforcement (what's being blocked RIGHT NOW)
- Repeat offender tracking (offense count)
- Escalation timeline (next timeout level)

**API Endpoint**:
```typescript
GET /api/analytics/blacklist
```

**Database Source**:
```sql
SELECT
  fb.id, fb.ephemeral_id, fb.ip_address, fb.block_reason,
  fb.blocked_at, fb.expires_at,
  (SELECT COUNT(*) FROM fraud_blacklist 
   WHERE (ephemeral_id = fb.ephemeral_id OR ip_address = fb.ip_address)
   AND blocked_at > datetime('now', '-24 hours')) as offense_count,
  CASE fb.detection_confidence
    WHEN 'high' THEN 100
    WHEN 'medium' THEN 80
    WHEN 'low' THEN 70
    ELSE 50
  END as risk_score
FROM fraud_blacklist fb
WHERE fb.expires_at > datetime('now')
```

---

### Section C: BlockedValidationsSection
**File**: `frontend/src/components/analytics/sections/BlockedValidationsSection.tsx`  
**Data Source**: `useBlockedValidations` hook → `/api/analytics/blocked-validations`  
**Database Query**: `turnstile_validations WHERE allowed = 0 ORDER BY created_at DESC LIMIT 50`

**What It Shows**:
- Paginated list of **recent blocked validation attempts** (up to 20 displayed)
- For each: detection type, timestamp, IP, risk score, JA4 fingerprint, block reason
- Color-coded by detection type (JA4, Ephemeral, IP, Other)

**Data Shape**:
```typescript
BlockedValidation {
  id: number;
  ephemeral_id: string | null;
  ip_address: string;
  country: string | null;
  block_reason: string;
  risk_score: number;
  challenge_ts: string;
  ja4: string | null;
  detection_type: 'ja4_fraud' | 'ephemeral_fraud' | 'ip_fraud' | 'other';
}
```

**Insights Provided**:
- Recent attack patterns (what happened recently?)
- Detection method breakdown (JA4 vs ephemeral vs IP)
- Geographic/technical metadata for investigation

**API Endpoint**:
```typescript
GET /api/analytics/blocked-validations?limit=100
```

---

## Section 2: Data Relationship Analysis

### The Three Distinct Data Concepts

#### Concept 1: Detection Events (turnstile_validations)
**Table**: `turnstile_validations`  
**Stores**: Every validation attempt (success OR failure)  
**Key Field**: `allowed` (0 = blocked, 1 = allowed)  
**Time Window**: All time (with indexes on created_at)  
**Queries**: Append-only log of what happened

```sql
-- What was blocked?
SELECT * FROM turnstile_validations WHERE allowed = 0 ORDER BY created_at DESC
-- Result: Recent attempted fraud incidents
```

#### Concept 2: Enforcement Cache (fraud_blacklist)
**Table**: `fraud_blacklist`  
**Stores**: Currently active blocks with auto-expiry  
**Key Fields**: `ephemeral_id`, `ip_address`, `ja4`, `expires_at`  
**Time Window**: Only active entries (expires_at > NOW)  
**Queries**: Pre-validation checks (10ms lookup)

```sql
-- What's currently blocked?
SELECT * FROM fraud_blacklist WHERE expires_at > datetime('now')
-- Result: Real-time enforcement state
```

#### Concept 3: Analysis Metrics (aggregated from turnstile_validations)
**Source**: Aggregations of detection events  
**Stores**: Calculated on-the-fly (not persisted)  
**Queries**: GROUP BY for statistics

```sql
-- Statistical summary
SELECT block_reason, COUNT(*) as count, ...
FROM turnstile_validations WHERE allowed = 0
GROUP BY block_reason
-- Result: Patterns and categories
```

### The Critical Difference

| Aspect | Detection Events | Enforcement Cache | Analysis Metrics |
|--------|------------------|-------------------|------------------|
| **Table** | turnstile_validations | fraud_blacklist | (calculated) |
| **Semantics** | "What was detected?" | "What's blocked now?" | "What's the pattern?" |
| **Time Scope** | All time | Only active (expires_at > NOW) | All time or windowed |
| **Row Count** | 100,000s | 100s | N/A |
| **Purpose** | Audit trail | Real-time blocking | Trend analysis |
| **Example** | "Attack at 2:15pm" | "IP X blocked until 4pm" | "50% of blocks are JA4" |

---

## Section 3: Redundancy & Confusion Analysis

### Overlap 1: Block Reason Appears in Multiple Places

**BlockedStatsSection.BlockReasons** shows:
```
"JA4 Session Hopping" → 45 attempts, 12 unique ephemeral IDs, 8 IPs, risk 92
"Ephemeral ID: Multiple submissions" → 120 attempts, 45 unique IDs, 40 IPs, risk 75
```

**BlockedValidationsSection** shows:
```
[Recent validation 1] JA4 Session Hopping, IP 192.168.1.1, risk 92
[Recent validation 2] Ephemeral ID, IP 10.0.0.5, risk 80
[Recent validation 3] JA4 Session Hopping, IP 44.55.66.77, risk 95
```

**Redundancy**: Same block reasons appear in both sections. BlockedStats is the AGGREGATE. BlockedValidations is the DETAIL for recent attempts.

**Problem**: A user seeing both might think they're different datasets or that BlockedValidations is outdated.

---

### Overlap 2: Risk Scoring and Confidence Levels

**BlockedStatsSection**: Shows `avg_risk_score` from turnstile_validations

**BlacklistSection**: Shows `risk_score` derived from `detection_confidence`:
- high → 100
- medium → 80  
- low → 70

**Confusion**: These are calculated differently and may show different numbers for the same block reason!

Example:
```
Block reason "JA4 Session Hopping" blocked 3 times:
- Attempt 1: risk_score = 95 (from turnstile_validations)
- Attempt 2: risk_score = 92 (from turnstile_validations)
- Attempt 3: risk_score = 90 (from turnstile_validations)

BlockedStatsSection shows: avg_risk_score = 92.3

But when added to blacklist as "medium" confidence:
BlacklistSection shows: risk_score = 80

↑ User sees different numbers and gets confused
```

---

### Overlap 3: "Distinct Users Blocked" vs "Active Blocks"

**BlockedStatsSection** Card 2:
- "Distinct Users Blocked: 250"
- This means 250 unique ephemeral IDs have triggered blocked validations (ever)

**BlacklistSection**:
- Showing ~50 active entries (smaller number)
- These are currently enforced blocks
- Only includes entries not yet expired

**Confusion**: User sees "250 distinct users blocked" but only 50 in the active list. Did 200 expire? Are 200 no longer a threat? **No clear explanation.**

---

## Section 4: Data Flow & Relationships

```
User submits form
        ↓
    Turnstile validation
        ↓
    Fraud detection analysis
        ↓
    ┌─────────────────────────────────┐
    │ Risk Score >= 70?               │
    │ (high confidence threat)         │
    └─────────────────────────────────┘
        │                    │
       YES                   NO
        ↓                    ↓
    [Block]             [Allow, Log]
        │                    │
        ├─ Log to           └─ Log to
        │  turnstile_         turnstile_
        │  validations        validations
        │  (allowed=0)        (allowed=1)
        │
        └─ ADD TO fraud_blacklist
           (if confidence high)
           with expiry date
           
        ↓
        
Next request from same
ephemeral_id/IP/JA4?
        ↓
    Pre-validation check
        ↓
    fraud_blacklist hit?
        ↓
       YES → Block immediately (10ms)
        NO → Full validation (150ms)
```

---

## Section 5: Dashboard Display Issues

### Issue 1: Missing Context on What "Blocked" Means

User sees:
- BlockedStatsSection: "Total Blocked Attempts: 1,250"
- BlacklistSection: "Active Blacklist Entries: 45"

**Question**: Did 1,205 entries expire, or are they still there?

**Real Answer**: Partially both:
- Some expired naturally (timeout passed)
- Some never made it to blacklist (low confidence blocks)
- Some might still be in transit

---

### Issue 2: No Distinction Between Detection Layers

From CLAUDE.md, we know there are **3 detection layers**:

1. **Layer 1: Pre-validation blacklist** (fraud_blacklist table)
2. **Layer 2: Turnstile validation** (token check)
3. **Layer 3: Pattern analysis** (ephemeral ID/IP/JA4 checks)

Current dashboard doesn't explain which layer blocked what.

Example: Block reason "Ephemeral ID: Multiple submissions in 24h"
- User doesn't know if this was:
  - Pre-validation cache hit (Layer 1, ~10ms)
  - Pattern analysis detection (Layer 3, ~50ms)
  - Combination of both

---

### Issue 3: Offense Count Calculation is Opaque

BlacklistSection shows:
```
Offense #2 (next: 4h)
```

**How is this calculated?**

From code:
```sql
SELECT COUNT(*) FROM fraud_blacklist
WHERE (ephemeral_id = fb.ephemeral_id OR ip_address = fb.ip_address)
AND blocked_at > datetime('now', '-24 hours')
```

**Problems**:
- Only counts last 24h
- Doesn't distinguish between different offense reasons
- User can't tell: "Is this their 2nd time for JA4 fraud, or 2nd time overall?"

---

## Section 6: Best Practices Research

### How Security Dashboards Typically Organize Threat Data

#### Pattern 1: Funnel/Conversion Model
```
Detection → Analysis → Enforcement → Compliance
   ↓           ↓           ↓              ↓
"1,250    "250 high   "45 active     "98% blocked
detected"  confidence" blocks"        in <5 secs"
```

#### Pattern 2: Time-Based Hierarchy
```
Real-time (last hour)
    ↓ What's actively blocked?
    ↓ What's the current threat level?
    
Recent (last 24h)
    ↓ What patterns emerged?
    ↓ Which techniques were used?
    
Historical (last 30 days)
    ↓ Trends and seasonality?
    ↓ How's defense posture?
```

#### Pattern 3: Incident Response Flow
```
Alert/Trigger
    ↓
Pattern Analysis
    ↓
Enforcement Action
    ↓
Monitoring/Expiry
```

### Industry Examples

**Cloudflare Security Analytics**:
1. Top-level threat summary (threats/min)
2. Threat breakdown (bot traffic, DDoS, SQL injection)
3. Mitigated vs passed
4. Recent events list

**Okta Security Dashboard**:
1. Authentication events (failed/successful)
2. Risk events (suspicious behavior)
3. Device posture
4. Active sessions/devices

**AWS GuardDuty**:
1. Findings count (current active)
2. Finding types (categories)
3. Recent findings (timeline)
4. Finding severity/confidence

**Key Insight**: Good dashboards separate:
- **Overview** (summary metrics)
- **Categorization** (types and reasons)
- **Details** (individual events)
- **Timeline** (when it happened)

---

## Section 7: Data Quality Observations

### Observation 1: Block Reason Variability

Current block reasons (from FRAUD-DETECTION.md):
- "Ephemeral ID: Multiple submissions" (Layer 3)
- "Validation attempts too frequent" (Layer 3)
- "IP Diversity: Multiple IPs per ephemeral ID" (Layer 3)
- "Session Hopping detected: JA4 clustering" (Layer 4)
- "Automated: Multiple submissions" (Layer 3)
- etc.

**Issue**: These are inconsistent in naming and don't clearly indicate:
1. Which detection layer triggered it
2. How confident we are (risk score is separate)
3. What the actual threat pattern was

**Example**: "Ephemeral ID: Multiple submissions" could mean:
- 2 submissions in 24h (riskScore = 100)
- 5 submissions in 1h (riskScore = 100)
- 10 submissions ever (riskScore varies)

But UI just shows the count, not the context.

---

### Observation 2: Ephemeral ID vs IP vs JA4 Tracking

Blacklist stores 3 identifiers:
```sql
ephemeral_id TEXT,
ip_address TEXT,
ja4 TEXT,
CHECK((ephemeral_id IS NOT NULL) OR (ip_address IS NOT NULL) OR (ja4 IS NOT NULL))
```

But UI doesn't clearly distinguish:
- Which identifier triggered the block?
- Is this ephemeral ID based, IP-based, or device-based (JA4)?

---

## Section 8: Proposed Restructured Approach

### Core Principle: Clear Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRAUD DETECTION DASHBOARD                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  LAYER 1: REAL-TIME ENFORCEMENT (What's blocked RIGHT NOW?)    │
│  ─────────────────────────────────────────────────────────────  │
│  [ActiveBlocksOverview]                                         │
│    • Active blocks: 45 / 1,250 total attempts                   │
│    • Coverage: 85% of threat attempts blocked                   │
│    • Confidence: 42 high, 3 medium                              │
│                                                                   │
│  LAYER 2: THREAT CATEGORIZATION (Why were things blocked?)      │
│  ─────────────────────────────────────────────────────────────  │
│  [ThreatBreakdown]                                              │
│    JA4 Session Hopping                    45 detections         │
│      ├─ 8 high-confidence blocks                                │
│      ├─ 37 allowed (but flagged)                                │
│      └─ Avg risk: 92                                            │
│                                                                   │
│    Ephemeral ID: Rapid Submissions        120 detections        │
│      ├─ 35 high-confidence blocks                               │
│      ├─ 85 allowed                                              │
│      └─ Avg risk: 78                                            │
│                                                                   │
│    IP Diversity: Multiple IPs             85 detections         │
│      ├─ ...                                                      │
│                                                                   │
│  LAYER 3: ACTIVE BLOCKS DETAIL (Individual entries)             │
│  ─────────────────────────────────────────────────────────────  │
│  [ActiveBlacklistDetail]                                        │
│    [Ephemeral: eph:abc123]  Threat: JA4 Hopping                │
│      Risk: 95 | Confidence: High | Offense #2 | Expires: 2h    │
│                                                                   │
│    [IP: 192.168.1.1]  Threat: IP Diversity                     │
│      Risk: 87 | Confidence: Medium | Offense #1 | Expires: 3h  │
│                                                                   │
│  LAYER 4: RECENT ATTEMPTS (Timeline view)                       │
│  ─────────────────────────────────────────────────────────────  │
│  [RecentDetections]                                             │
│    12:45:22 | JA4 Hopping | 192.168.1.1 | Risk: 92 | BLOCKED   │
│    12:43:15 | Rapid Subs   | 10.0.0.5    | Risk: 75 | ALLOWED   │
│    12:41:08 | IP Diversity | 44.55.66.77 | Risk: 88 | BLOCKED   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Renamed & Reorganized Sections

#### Section 1: ActiveBlocksOverview (NEW)
**Purpose**: Quick status on enforcement

**Data**:
- Active blocks count
- Blocked vs total attempts ratio
- Confidence distribution (high/medium/low)
- Top threat type

**Source**: 
- `fraud_blacklist` for counts
- `turnstile_validations` for ratio
- Computed on dashboard load

---

#### Section 2: ThreatCategorization (RENAME from BlockedStatsSection)
**Purpose**: Understand what threat types we're seeing

**Key Changes**:
- Group by threat TYPE not just reason
- Show blocked vs allowed breakdown per type
- Make risk scoring clear
- Link to detection layer explanation

**Data**:
```typescript
ThreatCategory {
  type: 'ja4_fraud' | 'ephemeral_fraud' | 'ip_fraud';
  displayName: 'JA4 Session Hopping' | 'Rapid Submissions' | 'IP Diversity';
  totalDetections: number;           // All attempts (blocked + allowed)
  highConfidenceBlocks: number;      // Blocked with high confidence
  mediumConfidenceBlocks: number;    // Blocked with medium confidence
  allowedButFlagged: number;         // Allowed but triggered detection
  avgRiskScore: number;
  detectionLayer: string;            // "Layer 3" or "Layer 4"
  description: string;               // "Detects same-device attacks using TLS fingerprinting"
}
```

---

#### Section 3: ActiveBlacklistDetail (RENAME from BlacklistSection)
**Purpose**: See current enforcement entries with full context

**Key Changes**:
- Add "Threat Type" column (detect what class of threat)
- Show offense progression clearly
- Add link to "why was this detected?" explanation
- Color code by confidence level

**Data** (same as before but with richer context):
```typescript
ActiveBlock {
  identifier: string;                // ephemeral_id, IP, or JA4
  identifierType: 'ephemeral' | 'ip' | 'ja4_fingerprint';
  threatType: 'ja4_fraud' | 'ephemeral_fraud' | 'ip_fraud';
  riskScore: number;
  confidence: 'high' | 'medium' | 'low';
  offenseCount: number;
  offenseProgression: ProgressiveTimeout[];
  currentTimeout: string;            // e.g., "4 hours (2nd offense)"
  nextTimeout: string | null;        // e.g., "8 hours (3rd offense)"
  expiresAt: string;
  blockedAt: string;
  blockReason: string;
}
```

---

#### Section 4: RecentDetections (RENAME from BlockedValidationsSection)
**Purpose**: Timeline of recent suspicious activity

**Key Changes**:
- Show all detections (blocked + allowed with high risk)
- Clear "Action Taken" column (BLOCKED / FLAGGED / ALLOWED)
- Threat type badge
- Better metadata display

**Data** (enriched):
```typescript
Detection {
  id: number;
  timestamp: string;
  threatType: 'ja4_fraud' | 'ephemeral_fraud' | 'ip_fraud' | 'unknown';
  identifier: {
    ephemeralId?: string;
    ipAddress: string;
    ja4?: string;
    country?: string;
  };
  riskScore: number;
  actionTaken: 'BLOCKED' | 'FLAGGED' | 'ALLOWED';
  blockReason?: string;
  confidence?: 'high' | 'medium' | 'low';
  detectionLayer: number;            // 1, 2, 3, or 4
}
```

---

### New Components

#### Component: ThreatTypeExplainer
**Purpose**: Help users understand threat categories

**Shows for each threat type**:
- What it detects
- Why it's dangerous
- Which detection layer handles it
- Example attack pattern

---

#### Component: OffenseProgressionTimeline
**Purpose**: Visualize the escalation logic

```
Offense #1 → 1h timeout
    ↓
Offense #2 → 4h timeout ← Currently here
    ↓
Offense #3 → 8h timeout
    ↓
Offense #4 → 12h timeout
    ↓
Offense #5+ → 24h timeout
```

---

## Section 9: Implementation Roadmap

### Phase 1: Clarify Existing Data
**Goal**: Fix confusion without major refactoring

**Changes**:
1. Rename BlockedStatsSection → ThreatBreakdown
2. Add threat type labels to BlockedValidations
3. Add explanation text for each threat type
4. Show "expires_at" more clearly in blacklist

**Effort**: Low (mostly UI labels)  
**Impact**: Moderate (users understand what they're seeing)

---

### Phase 2: Add Missing Context
**Goal**: Connect data to detection layers

**Changes**:
1. Add `detectionLayer` field to BlockedValidation response
2. Add threat type inference to BlockedValidation query
3. Add ThreatTypeExplainer component
4. Add risk score explanation in tooltips

**Effort**: Medium  
**Impact**: High (users understand WHY things were blocked)

---

### Phase 3: Reorganize Sections
**Goal**: Implement proposed hierarchy

**Changes**:
1. Create ActiveBlocksOverview component
2. Refactor sections into new order
3. Add missing calculated fields to queries
4. Improve spacing/grouping

**Effort**: Medium-High  
**Impact**: High (better UX, clearer hierarchy)

---

### Phase 4: Visual Improvements (Optional)
**Goal**: Make relationships crystal clear

**Changes**:
1. Add small sparklines showing trend
2. Color code by threat type consistently
3. Add icons for threat categories
4. Progressive disclosure (collapse by default, expand on click)

**Effort**: Low-Medium  
**Impact**: Medium (looks better, still same info)

---

## Section 10: SQL Query Recommendations

### Query 1: Threat Categories Summary
```sql
SELECT
  CASE
    WHEN block_reason LIKE '%JA4%' THEN 'ja4_fraud'
    WHEN block_reason LIKE '%session hopping%' THEN 'ja4_fraud'
    WHEN block_reason LIKE '%ephemeral%' THEN 'ephemeral_fraud'
    WHEN block_reason LIKE '%Automated:%' THEN 'ephemeral_fraud'
    WHEN block_reason LIKE '%Multiple submissions%' THEN 'ephemeral_fraud'
    WHEN block_reason LIKE '%IP%' THEN 'ip_fraud'
    ELSE 'other'
  END as threat_type,
  COUNT(*) as total_detections,
  COUNT(CASE WHEN allowed = 0 THEN 1 END) as blocked_count,
  COUNT(CASE WHEN allowed = 1 THEN 1 END) as allowed_count,
  AVG(risk_score) as avg_risk_score,
  COUNT(DISTINCT ephemeral_id) as unique_ephemeral_ids,
  COUNT(DISTINCT remote_ip) as unique_ips
FROM turnstile_validations
WHERE created_at > datetime('now', '-30 days')
GROUP BY threat_type
ORDER BY blocked_count DESC
```

### Query 2: Active Blocks with Threat Context
```sql
SELECT
  fb.id,
  fb.ephemeral_id,
  fb.ip_address,
  fb.ja4,
  CASE
    WHEN fb.ja4 IS NOT NULL THEN 'ja4_fingerprint'
    WHEN fb.ephemeral_id IS NOT NULL THEN 'ephemeral'
    ELSE 'ip'
  END as identifier_type,
  CASE
    WHEN fb.block_reason LIKE '%JA4%' THEN 'ja4_fraud'
    WHEN fb.block_reason LIKE '%ephemeral%' THEN 'ephemeral_fraud'
    ELSE 'ip_fraud'
  END as threat_type,
  fb.block_reason,
  CASE fb.detection_confidence
    WHEN 'high' THEN 100
    WHEN 'medium' THEN 80
    WHEN 'low' THEN 70
    ELSE 50
  END as risk_score,
  fb.detection_confidence,
  (SELECT COUNT(*) FROM fraud_blacklist
   WHERE (ephemeral_id = fb.ephemeral_id OR ip_address = fb.ip_address)
   AND blocked_at > datetime('now', '-24 hours')) as offense_count,
  fb.blocked_at,
  fb.expires_at,
  CAST((julianday(fb.expires_at) - julianday('now')) * 24 * 60 AS INTEGER) as minutes_until_expiry
FROM fraud_blacklist fb
WHERE fb.expires_at > datetime('now')
ORDER BY fb.blocked_at DESC
```

---

## Section 11: Recommended Reading Order for Users

When users view the dashboard:

1. **OverviewStats** (top) - Overall health
2. **FraudAlert** (next) - Critical patterns
3. **ThreatBreakdown** (middle) - Understand the threat landscape
4. **ActiveBlacklistDetail** (next) - See what's actively enforced
5. **RecentDetections** (bottom) - Drill into recent events
6. **ChartsSection** (last) - Trends and patterns

**Not here anymore**: They get confused by seeing 1,250 blocked attempts but only 45 in the active list.

---

## Summary of Recommendations

### Rename & Reorganize
| Current | Proposed | Key Changes |
|---------|----------|------------|
| BlockedStatsSection | ThreatBreakdown | Add threat type labels, remove aggregate "total blocked" |
| BlacklistSection | ActiveBlocksDetail | Add identifier type, threat type, link to detection layer |
| BlockedValidationsSection | RecentDetections | Show all detections (blocked+flagged), add threat type |
| (None) | ActiveBlocksOverview | NEW: High-level status card |

### Add Context
- Each section should explain what it's showing and why
- Link threat types to detection layers
- Show confidence levels clearly
- Explain offense progression logic

### Clarify Data Flow
- Detection events → Analysis → Enforcement → Expiry
- Not all detections lead to blocks
- Not all blocks end up in blacklist
- Active blocks are subset of all attempts

### Visual Improvements
- Consistent color coding by threat type
- Risk score mapping (numeric + confidence level)
- Progressive disclosure for complex info
- Better grouping and spacing

---

## Conclusion

The current dashboard conflates three distinct concepts (detection events, enforcement cache, and analysis metrics) in ways that confuse users. By reorganizing around a clear hierarchy and adding explanatory context, we can transform it from "what happened?" to "what's happening and why?"

The proposed structure:
1. **Real-time enforcement** (what's blocked now?)
2. **Threat categorization** (what types of threats?)
3. **Active blocks detail** (which specific entries?)
4. **Recent timeline** (what just happened?)

This mirrors how security operations centers typically organize threat data and will significantly improve usability.
