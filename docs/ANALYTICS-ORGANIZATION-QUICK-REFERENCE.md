# Analytics Organization - Quick Reference

## Current State (3 Overlapping Sections)

```
┌─────────────────────────────────────────────────────────────────────┐
│ BlockedStatsSection (Stats from turnstile_validations WHERE allowed=0) │
├─────────────────────────────────────────────────────────────────────┤
│ Total Blocked: 1,250                                                 │
│ Unique Users: 250                                                    │
│ Unique IPs: 180                                                      │
│ Avg Risk: 82                                                         │
│                                                                       │
│ Block Reasons Breakdown:                                             │
│   JA4 Session Hopping: 45 attempts, risk 92                         │
│   Multiple Submissions: 120 attempts, risk 75                       │
│   IP Diversity: 85 attempts, risk 88                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ BlacklistSection (Active entries from fraud_blacklist)               │
├─────────────────────────────────────────────────────────────────────┤
│ [Ephemeral: eph:abc...] JA4 Hopping | Risk: 95 | Offense #2 | 2h   │
│ [IP: 192.168.1.1]       IP Diversity | Risk: 87 | Offense #1 | 3h  │
│ [IP: 10.0.0.5]          Multiple Subs | Risk: 80 | Offense #3 | 1h │
│ ... (45 total active)                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ BlockedValidationsSection (Recent from turnstile_validations)        │
├─────────────────────────────────────────────────────────────────────┤
│ 12:45:22 | JA4 Hopping  | 192.168.1.1 | Risk: 92 | BLOCKED        │
│ 12:43:15 | Multiple Subs | 10.0.0.5   | Risk: 75 | ALLOWED         │
│ 12:41:08 | IP Diversity | 44.55.66.77 | Risk: 88 | BLOCKED         │
│ ... (20 displayed of many)                                           │
└─────────────────────────────────────────────────────────────────────┘

PROBLEM: User sees "1,250 blocked" but only "45 active blocks"
           → Where did the other 1,205 go?
           → Is the dashboard inconsistent?
           → Are these different things?
```

---

## The Three Concepts Conflated

### Concept A: Detection Events (turnstile_validations)
**What it is**: Log of attempted fraud incidents  
**Semantic**: "These attacks were detected"  
**Table**: `turnstile_validations WHERE allowed=0`  
**Count**: 100,000s of rows  
**Time window**: All time  
**Purpose**: Audit trail, trend analysis  

### Concept B: Enforcement Cache (fraud_blacklist)
**What it is**: Currently active blocks (auto-expiring)  
**Semantic**: "These are blocked RIGHT NOW"  
**Table**: `fraud_blacklist WHERE expires_at > NOW`  
**Count**: 10-100 rows  
**Time window**: Only active entries  
**Purpose**: Real-time blocking, pre-validation cache  

### Concept C: Analysis Metrics (aggregations)
**What it is**: Statistics calculated on the fly  
**Semantic**: "This is the pattern we're seeing"  
**Calculation**: GROUP BY, AVG, COUNT, etc.  
**Count**: N/A (calculated)  
**Time window**: Configurable (30d, 90d, all-time)  
**Purpose**: Reporting, trend identification  

---

## The Confusion: Why "1,250 blocked" but only "45 active?"

```
turnstile_validations (Detection Log)
├─ Allowed: 10,000 ✓ (successful submissions)
└─ Blocked: 1,250 ✗ (fraud detected)
   ├─ High confidence (risk >= 90): 250
   │  ├─ Added to blacklist: 200
   │  │  ├─ Still active: 45 ✓ (in fraud_blacklist, not expired)
   │  │  └─ Expired: 155 (timeout passed)
   │  └─ Not added: 50 (low confidence)
   │
   └─ Medium/Low confidence (risk < 90): 1,000
      └─ Not added to blacklist: 1,000

Bottom line:
  1,250 blocks detected    ← BlockedStatsSection
  200 added to blacklist   
  45 still active          ← BlacklistSection
  155 expired
  1,000 never blacklisted (logged but low confidence)
```

---

## The Fix: Clear Hierarchy

### Proposed New Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Real-time Status                                           │
├─────────────────────────────────────────────────────────────────────┤
│ [ActiveBlocksOverview]                                              │
│ Active Blocks: 45  |  Coverage: 85%  |  High Conf: 42  |  Med: 3  │
│                                                                      │
│ (What's being blocked RIGHT NOW? Quick view.)                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Threat Categorization                                      │
├─────────────────────────────────────────────────────────────────────┤
│ [ThreatBreakdown]                                                   │
│                                                                      │
│ JA4 Session Hopping         45 detections, 8 blocked, risk 92      │
│ Rapid Submissions           120 detections, 35 blocked, risk 78    │
│ IP Diversity                85 detections, 2 blocked, risk 88      │
│                                                                      │
│ (What types of threats? Blocked vs allowed breakdown.)             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Active Enforcement Details                                 │
├─────────────────────────────────────────────────────────────────────┤
│ [ActiveBlocksDetail]                                                │
│                                                                      │
│ [Ephemeral: eph:abc...]  Type: JA4 Hopping | Risk: 95 | #2 | 2h   │
│ [IP: 192.168.1.1]        Type: IP Diversity | Risk: 87 | #1 | 3h  │
│                                                                      │
│ (Which specific entries are blocked? How long until expiry?)       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 4: Recent Timeline                                            │
├─────────────────────────────────────────────────────────────────────┤
│ [RecentDetections]                                                  │
│                                                                      │
│ 12:45:22 | JA4 Hopping   | 192.168.1.1 | Risk: 92 | BLOCKED      │
│ 12:43:15 | Rapid Subs    | 10.0.0.5    | Risk: 75 | ALLOWED      │
│ 12:41:08 | IP Diversity  | 44.55.66.77 | Risk: 88 | BLOCKED      │
│                                                                      │
│ (What happened recently? When? Blocked or allowed?)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Clarity

### Before (Confusing)
```
User doesn't know:
- Why there are two numbers (1,250 vs 45)
- What the difference is
- Whether something is missing
- What "blocked" really means
```

### After (Clear)
```
User sees:
1. Active blocks RIGHT NOW (45)
2. Threat patterns detected (3 types)
3. Individual active entries (detailed)
4. Recent events (timeline)

User understands:
- Some detections don't lead to blocks
- Some blocks expire
- This is the current state, not cumulative
```

---

## Key Data Points to Show in Each Section

### ActiveBlocksOverview
- Active block count
- Total attempts in period
- Coverage % (blocked / total)
- Confidence distribution

### ThreatBreakdown
- Threat type (JA4, Ephemeral, IP)
- Total detections
- Blocked count
- Allowed count
- Avg risk score
- Which layer detects it

### ActiveBlocksDetail
- Identifier (ephemeral/IP/JA4)
- Threat type
- Risk score
- Confidence level
- Offense count
- Time until expiry
- Block reason

### RecentDetections
- Timestamp
- Threat type badge
- Identifier
- Risk score
- Action taken (BLOCKED/ALLOWED/FLAGGED)
- Detection layer
- Country/metadata

---

## Redundancy Eliminated

### Old: 3 sections with overlapping data
- BlockedStatsSection (aggregates)
- BlockedValidationsSection (details)
- BlacklistSection (enforcement)

### New: 4 sections with clear purpose
| Layer | Component | Purpose | Data Source |
|-------|-----------|---------|-------------|
| 1 | ActiveBlocksOverview | Current state | fraud_blacklist |
| 2 | ThreatBreakdown | Pattern understanding | turnstile_validations (GROUP BY) |
| 3 | ActiveBlocksDetail | Individual entries | fraud_blacklist + JOIN |
| 4 | RecentDetections | Timeline | turnstile_validations (DESC) |

Each layer answers a different question.  
No redundancy.  
Clear progression from summary → detail.

---

## Implementation Priority

### Phase 1 (Quick, High Value)
- Rename sections for clarity
- Add threat type labels
- Add explanation text
- Update section order

### Phase 2 (Medium, High Value)
- Add ActiveBlocksOverview component
- Reorganize sections
- Add detection layer info
- Improve grouping

### Phase 3 (Polish)
- Add sparklines/trends
- Color coding by threat type
- Progressive disclosure
- Better tooltips

---

## Key Insight

The current dashboard shows:
- "1,250 attempts were blocked" (detection metric)
- "45 entries are active" (enforcement metric)

These are measuring different things at different times!

The fixed dashboard explains:
- "45 blocks are active RIGHT NOW" (enforcement)
- "3 types of threats detected" (patterns)
- "120 rapid submission attempts detected, 35 blocked" (detail)
- "12:45am attack attempt from 192.168.1.1" (timeline)

Each layer answers its own question. Users see the full picture.
