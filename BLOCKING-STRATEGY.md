# Client-Side Blocking Strategy with Turnstile Callbacks

## Overview

This document outlines how to implement client-side blocking based on server-side Turnstile validation and track all validation attempts in D1.

---

## Question 1: Can we block with the site-verify callback to the widget?

### Answer: Yes! Using a Two-Step Validation Flow

The strategy is to validate the Turnstile token **before** submitting the actual form data, and block at the client-side based on the validation response.

### Implementation Flow

```
User submits form
    ↓
Turnstile widget callback fires with token
    ↓
Client calls POST /api/turnstile/verify (validation only)
    ↓
Server validates with siteverify API
    ↓
Server checks ephemeral ID fraud patterns
    ↓
Server returns: { allowed: true/false, reason: string }
    ↓
If allowed: Client submits form data to POST /api/submissions
If blocked: Show error message, don't submit form
```

### Benefits

✅ **Early Blocking**: Stop malicious submissions before they hit the main endpoint
✅ **Better UX**: Clear error messages for blocked users
✅ **Reduced Load**: Don't process form data if Turnstile fails
✅ **Tracking**: Log all validation attempts (successful and blocked)
✅ **Fraud Prevention**: Check ephemeral ID patterns before accepting submission

---

## Client-Side Implementation

### TurnstileWidget Component with Pre-Validation

```typescript
// TurnstileWidget.tsx
import { useRef, useState } from 'preact/hooks';

export default function TurnstileWidget({ onValidated, onError }) {
  const [validating, setValidating] = useState(false);
  const widgetIdRef = useRef<string | null>(null);

  async function handleCallback(token: string) {
    setValidating(true);

    try {
      // Step 1: Validate token with our API
      const response = await fetch('/api/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const result = await response.json();

      if (response.ok && result.allowed) {
        // ✅ Validation passed - allow form submission
        onValidated({
          token,
          ephemeralId: result.ephemeralId,
          validationId: result.validationId
        });
      } else {
        // ❌ Validation failed - block submission
        onError({
          blocked: true,
          reason: result.reason,
          message: result.message || 'Verification failed. Please try again.',
          riskScore: result.riskScore
        });

        // Reset widget for retry
        if (widgetIdRef.current) {
          setTimeout(() => {
            turnstile.reset(widgetIdRef.current);
          }, 2000);
        }
      }
    } catch (error) {
      // Network error
      onError({
        blocked: false,
        reason: 'network_error',
        message: 'Network error. Please check your connection.'
      });
    } finally {
      setValidating(false);
    }
  }

  // Widget render logic
  useEffect(() => {
    if (!containerRef.current) return;

    turnstile.ready(() => {
      const widgetId = turnstile.render(containerRef.current, {
        sitekey: '0x4AAAAAACAjw0bmUZ7V7fh2',
        theme: 'auto',
        size: 'flexible',
        appearance: 'interaction-only',
        execution: 'execute',
        callback: handleCallback, // ← Our validation handler
        'error-callback': (error) => {
          onError({
            blocked: false,
            reason: 'turnstile_error',
            message: 'Verification error. Please try again.',
            error
          });
        }
      });

      widgetIdRef.current = widgetId;
    });
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      {validating && <p className="text-sm text-gray-500">Validating...</p>}
    </div>
  );
}
```

### Form Component with Validation Flow

```typescript
// TurnstileForm.astro
<script>
  let turnstileToken: string | null = null;
  let validationId: string | null = null;
  let ephemeralId: string | null = null;

  // Called when Turnstile validation succeeds
  function handleTurnstileValidated(data: any) {
    turnstileToken = data.token;
    validationId = data.validationId;
    ephemeralId = data.ephemeralId;

    // Enable submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }

    console.log('Turnstile validated:', { validationId, ephemeralId });
  }

  // Called when Turnstile validation fails
  function handleTurnstileError(error: any) {
    turnstileToken = null;
    validationId = null;
    ephemeralId = null;

    // Show error message
    showNotification(error.message, 'error');

    // Disable submit button
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
    }

    // Log blocked attempt
    if (error.blocked) {
      console.warn('Submission blocked:', error.reason, error.riskScore);
    }
  }

  // Form submission handler
  async function handleSubmit(e: Event) {
    e.preventDefault();

    // Check if we have a validated token
    if (!turnstileToken || !validationId) {
      showNotification('Please complete the security check', 'error');

      // Trigger Turnstile if not already done
      if (window.turnstileWidget) {
        window.turnstileWidget.execute();
      }
      return;
    }

    // Collect form data
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      dateOfBirth: formData.get('dateOfBirth'),
      validationId // Include validation ID to link with pre-validation
    };

    try {
      // Submit form (validation already done)
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('Form submitted successfully!', 'success');
        // Reset form
        (e.target as HTMLFormElement).reset();
        turnstileToken = null;
        validationId = null;
      } else {
        showNotification(result.message || 'Submission failed', 'error');
      }
    } catch (error) {
      showNotification('Network error. Please try again.', 'error');
    }
  }

  // Expose handlers to widget
  window.handleTurnstileValidated = handleTurnstileValidated;
  window.handleTurnstileError = handleTurnstileError;
</script>
```

---

## Question 2: How do we count blocked attempts? Using D1?

### Answer: Yes! Create a Validation Tracking Table

We need to track **all** Turnstile validation attempts, not just successful submissions.

### D1 Schema for Validation Tracking

```sql
-- Table: turnstile_validations
-- Purpose: Track all validation attempts (success and failures)
CREATE TABLE turnstile_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Validation result
  success BOOLEAN NOT NULL,
  allowed BOOLEAN NOT NULL, -- False if blocked by fraud detection
  block_reason TEXT, -- Why was it blocked? (if allowed = false)

  -- Turnstile data
  challenge_ts TEXT,
  hostname TEXT,
  action TEXT,

  -- Ephemeral ID tracking
  ephemeral_id TEXT,
  risk_score INTEGER DEFAULT 0,

  -- Request metadata
  remote_ip TEXT,
  user_agent TEXT,

  -- Error information (if failed)
  error_codes TEXT, -- JSON array of error codes

  -- Linking
  submission_id INTEGER, -- Links to submissions table (if submission created)

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics
CREATE INDEX idx_validations_ephemeral ON turnstile_validations(ephemeral_id);
CREATE INDEX idx_validations_created ON turnstile_validations(created_at DESC);
CREATE INDEX idx_validations_allowed ON turnstile_validations(allowed);
CREATE INDEX idx_validations_success ON turnstile_validations(success);
```

### Why This Schema?

1. **Track Everything**: Both successful and failed validations
2. **Fraud Metrics**: Count blocked attempts by reason
3. **Ephemeral Patterns**: See which ephemeral IDs are problematic
4. **Analytics**: Calculate success rate, block rate, error types
5. **Audit Trail**: Full history of all validation attempts

---

## Server-Side Implementation

### POST /api/turnstile/verify (Pre-Validation Endpoint)

```typescript
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

interface VerifyRequest {
  token: string;
}

interface VerifyResponse {
  allowed: boolean;
  validationId: number;
  ephemeralId?: string;
  riskScore?: number;
  reason?: string;
  message?: string;
}

app.post('/api/turnstile/verify', async (c) => {
  const body = await c.req.json<VerifyRequest>();
  const token = body.token;

  if (!token) {
    return c.json({ error: 'Token is required' }, 400);
  }

  const remoteIp = c.req.header('CF-Connecting-IP') || 'unknown';
  const userAgent = c.req.header('User-Agent') || 'unknown';

  // Step 1: Validate with Cloudflare siteverify API
  const validation = await validateTurnstileToken(
    token,
    remoteIp,
    c.env['TURNSTILE-SECRET-KEY']
  );

  let allowed = validation.valid;
  let blockReason: string | null = null;
  let riskScore = 0;
  const ephemeralId = validation.ephemeralId || null;

  // Step 2: Check fraud patterns (if validation succeeded)
  if (validation.valid && ephemeralId) {
    const fraudCheck = await checkEphemeralIdFraud(ephemeralId, c.env.DB);
    riskScore = fraudCheck.riskScore;

    if (!fraudCheck.allowed) {
      allowed = false;
      blockReason = fraudCheck.reason || 'fraud_detection';
    }
  }

  // Step 3: Log validation attempt to D1
  const validationRecord = await c.env.DB.prepare(
    `INSERT INTO turnstile_validations
     (success, allowed, block_reason, challenge_ts, hostname, action,
      ephemeral_id, risk_score, remote_ip, user_agent, error_codes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      validation.valid ? 1 : 0,
      allowed ? 1 : 0,
      blockReason,
      validation.data?.challenge_ts || null,
      validation.data?.hostname || null,
      validation.data?.action || null,
      ephemeralId,
      riskScore,
      remoteIp,
      userAgent,
      validation.valid ? null : JSON.stringify(validation.errors)
    )
    .run();

  const validationId = validationRecord.meta.last_row_id;

  // Step 4: Return response
  if (!allowed) {
    const message = blockReason === 'fraud_detection'
      ? 'Too many submissions detected. Please try again later.'
      : 'Verification failed. Please try again.';

    return c.json(
      {
        allowed: false,
        validationId,
        reason: blockReason || 'validation_failed',
        message,
        riskScore
      } as VerifyResponse,
      429 // Too Many Requests
    );
  }

  return c.json({
    allowed: true,
    validationId,
    ephemeralId,
    riskScore
  } as VerifyResponse);
});
```

### POST /api/submissions (Main Submission Endpoint)

```typescript
app.post('/api/submissions', async (c) => {
  const body = await c.req.json();
  const { validationId, ...formData } = body;

  // Validate form data
  const validation = FormSchema.safeParse(formData);
  if (!validation.success) {
    return c.json({ error: 'Invalid form data' }, 400);
  }

  // Check if validation ID exists and is valid
  if (!validationId) {
    return c.json({ error: 'Validation ID required' }, 400);
  }

  const validationRecord = await c.env.DB.prepare(
    `SELECT * FROM turnstile_validations
     WHERE id = ?
     AND allowed = 1
     AND created_at > datetime('now', '-5 minutes')`
  )
    .bind(validationId)
    .first();

  if (!validationRecord) {
    return c.json(
      {
        error: 'Invalid or expired validation',
        message: 'Please complete the security check again'
      },
      400
    );
  }

  // Check if validation was already used
  if (validationRecord.submission_id) {
    return c.json(
      {
        error: 'Validation already used',
        message: 'Please refresh and try again'
      },
      400
    );
  }

  // Create submission
  const submission = await c.env.DB.prepare(
    `INSERT INTO submissions
     (first_name, last_name, email, phone, address, date_of_birth,
      ephemeral_id, remote_ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      validation.data.firstName,
      validation.data.lastName,
      validation.data.email,
      validation.data.phone,
      validation.data.address,
      validation.data.dateOfBirth,
      validationRecord.ephemeral_id,
      validationRecord.remote_ip,
      validationRecord.user_agent
    )
    .run();

  const submissionId = submission.meta.last_row_id;

  // Link validation to submission
  await c.env.DB.prepare(
    `UPDATE turnstile_validations
     SET submission_id = ?
     WHERE id = ?`
  )
    .bind(submissionId, validationId)
    .run();

  return c.json({
    success: true,
    id: submissionId,
    message: 'Submission created successfully'
  });
});
```

---

## Analytics: Counting Blocked Attempts

### GET /api/analytics/validation-stats

```typescript
app.get('/api/analytics/validation-stats', async (c) => {
  const stats = await c.env.DB.batch([
    // Total validations
    c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM turnstile_validations
    `),

    // Successful validations
    c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM turnstile_validations
      WHERE success = 1
    `),

    // Blocked validations (fraud detection)
    c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM turnstile_validations
      WHERE allowed = 0
    `),

    // Failed validations (Turnstile errors)
    c.env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM turnstile_validations
      WHERE success = 0
    `),

    // Blocks by reason
    c.env.DB.prepare(`
      SELECT
        block_reason,
        COUNT(*) as count
      FROM turnstile_validations
      WHERE allowed = 0
      GROUP BY block_reason
      ORDER BY count DESC
    `),

    // Validation success rate over time (last 24 hours)
    c.env.DB.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00', created_at) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN allowed = 0 THEN 1 ELSE 0 END) as blocked
      FROM turnstile_validations
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour
    `),

    // Top ephemeral IDs with blocked attempts
    c.env.DB.prepare(`
      SELECT
        ephemeral_id,
        COUNT(*) as blocked_count,
        AVG(risk_score) as avg_risk_score,
        MAX(created_at) as last_blocked
      FROM turnstile_validations
      WHERE allowed = 0
      AND ephemeral_id IS NOT NULL
      GROUP BY ephemeral_id
      ORDER BY blocked_count DESC
      LIMIT 10
    `)
  ]);

  const [total, successful, blocked, failed, blockReasons, timeline, topBlockedIds] = stats;

  return c.json({
    summary: {
      total: total.results[0].total,
      successful: successful.results[0].total,
      blocked: blocked.results[0].total,
      failed: failed.results[0].total,
      successRate: (successful.results[0].total / total.results[0].total) * 100,
      blockRate: (blocked.results[0].total / total.results[0].total) * 100
    },
    blockReasons: blockReasons.results,
    timeline: timeline.results,
    topBlockedEphemeralIds: topBlockedIds.results
  });
});
```

---

## Dashboard Visualization

### Metrics Cards

```typescript
// Dashboard components for validation tracking

1. **Total Validations**
   - Total count
   - Trend (vs last period)

2. **Success Rate**
   - Percentage of successful validations
   - Green if > 95%

3. **Block Rate**
   - Percentage blocked by fraud detection
   - Red if > 5%

4. **Failed Validations**
   - Percentage of Turnstile errors
   - Investigate if > 2%

5. **Top Block Reasons**
   - Pie chart of block reasons
   - fraud_detection, timeout, network_error, etc.

6. **Validation Timeline**
   - Line chart: successful, blocked, failed
   - 24-hour view
```

### Example Dashboard Component

```tsx
// ValidationStats.tsx
export function ValidationStats({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Validations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.summary.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {stats.summary.successRate.toFixed(1)}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {stats.summary.blocked}
          </div>
          <p className="text-sm text-gray-500">
            {stats.summary.blockRate.toFixed(1)}% of total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-yellow-600">
            {stats.summary.failed}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Benefits of This Approach

### ✅ Client-Side Blocking

1. **Early Prevention**: Block before form submission
2. **Better UX**: Clear error messages
3. **Reduced Server Load**: Don't process invalid requests
4. **User Feedback**: Show why they're blocked

### ✅ Comprehensive Tracking

1. **All Attempts**: Track successful and blocked
2. **Fraud Metrics**: Measure effectiveness
3. **Error Analysis**: Identify integration issues
4. **Audit Trail**: Full validation history

### ✅ Analytics Insights

1. **Success Rate**: Monitor validation health
2. **Block Patterns**: Identify attack vectors
3. **Ephemeral Trends**: Track problematic users
4. **Time-Based**: See attack timing

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    User Submits Form                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Turnstile Widget Callback                   │
│                 (Token Generated)                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│         POST /api/turnstile/verify                       │
│  1. Validate with Cloudflare siteverify                 │
│  2. Check ephemeral ID fraud patterns                   │
│  3. Calculate risk score                                │
│  4. Log to turnstile_validations table                  │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  ✅ Allowed     │    │  ❌ Blocked      │
│  Return 200     │    │  Return 429      │
└────────┬────────┘    └────────┬─────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────────┐
│ Enable Submit   │    │ Show Error       │
│ Button          │    │ Reset Widget     │
└────────┬────────┘    │ Disable Submit   │
         │             └──────────────────┘
         ▼
┌──────────────────────────────────────────┐
│    POST /api/submissions                 │
│  1. Verify validationId exists           │
│  2. Check not already used               │
│  3. Create submission                    │
│  4. Link to validation record            │
└──────────────────────────────────────────┘
```

---

## Summary

### Key Points

1. ✅ **Two-Step Validation**: Separate endpoints for validation and submission
2. ✅ **Client-Side Blocking**: Block before form submission based on server response
3. ✅ **D1 Tracking**: Log all validation attempts in `turnstile_validations` table
4. ✅ **Analytics**: Count blocked attempts by reason, ephemeral ID, time
5. ✅ **Fraud Prevention**: Check patterns before allowing submission
6. ✅ **User Experience**: Clear error messages for blocked users
7. ✅ **Audit Trail**: Complete history of all validation attempts

### Implementation Checklist

- ⬜ Create `turnstile_validations` table in D1
- ⬜ Implement POST `/api/turnstile/verify` endpoint
- ⬜ Update POST `/api/submissions` to check validation ID
- ⬜ Update client-side widget callback to call verify endpoint
- ⬜ Add error handling for blocked submissions
- ⬜ Create analytics endpoint for validation stats
- ⬜ Build dashboard components for validation metrics
- ⬜ Test blocking scenarios
- ⬜ Monitor block rate and adjust thresholds

Ready to implement! 🚀
