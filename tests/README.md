# End-to-End Tests

Automated browser tests using Playwright to verify form submission, Turnstile integration, and fraud detection.

## Test Suites

### 1. Basic Functionality (`form-submission.spec.ts`, `ephemeral-id.spec.ts`)
Standard tests for form validation, Turnstile integration, and basic fraud checks.

### 2. Fraud Stress Tests (`fraud-stress-test.spec.ts`)
**⚠️ Runs against PRODUCTION** - Aggressive tests designed to trigger fraud detection mitigations.

Tests include:
- **Rapid Submission Attack**: 20 submissions in rapid succession to trigger rate limiting
- **Token Replay Attack**: Attempts to reuse Turnstile tokens
- **Parallel Submission Attack**: 10 simultaneous submissions from same source
- **Distributed Attack**: 15 different users submitting to test tracking
- **Analytics Verification**: Confirms fraud metrics are recorded

## Running Tests

### Basic Tests

```bash
# Run all tests
npm test

# Run with UI mode (interactive)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run only basic tests
npm run test:basic
```

### Fraud Stress Tests

```bash
# Run fraud detection stress tests (against production)
npm run test:fraud

# Run with visible browser
npm run test:fraud:headed

# Run specific attack test
npx playwright test -g "Rapid Submission Attack"
```

## Test Configuration

See `playwright.config.ts`:
- **Target**: Production URL by default (`https://form.erfi.dev`)
- **Timeout**: 60s per test (fraud tests may take longer)
- **Screenshots**: Captured on failure
- **Video**: Retained on failure
- **Retries**: 2 retries in CI, 0 locally

## Environment Variables

```bash
# Test against different URL
TEST_URL=http://localhost:8787 npm test

# Run in CI mode (with retries)
CI=true npm test
```

## Expected Behavior

### Fraud Detection Triggers

**After rapid submissions:**
- Some requests should return 403 (Forbidden) or 429 (Too Many Requests)
- Risk scores should increase
- Subsequent submissions may be blocked

**Token replay attempts:**
- Reused tokens should be rejected (400 or 403)
- Only first use should succeed

**Parallel attacks:**
- System should handle load without crashing
- Rate limiting may trigger

### What Tests Verify

✅ **Security measures work:**
- Token replay protection active
- Rate limiting triggers under load
- Fraud detection identifies suspicious patterns

✅ **System remains stable:**
- Handles concurrent requests
- Doesn't crash under stress
- Returns proper error codes

✅ **Analytics track properly:**
- Submissions recorded
- Risk scores calculated
- Ephemeral IDs tracked (if Enterprise)

## Test Output

Tests provide detailed console output:

```
🚀 Starting rapid submission attack test...
✓ Submission 1/20: Status 200 (450ms)
✓ Submission 2/20: Status 200 (380ms)
✓ Submission 3/20: Status 403 (290ms)
...

📊 Rapid Submission Test Results:
   Total attempts: 20
   Succeeded: 7
   Blocked (403/429): 13
   Failed (other): 0
   Avg response time: 320ms

✓ Fraud detection TRIGGERED - 13 submissions blocked
```

## Turnstile Testing

Production uses real Turnstile challenges. Tests may:
- Wait for challenge completion
- Timeout on manual challenges
- Succeed with invisible Turnstile

**For local testing without solving challenges**, use these sitekeys in development:
- **Always passes**: `1x00000000000000000000AA`
- **Always fails**: `2x00000000000000000000AB`
- **Forces interactive challenge**: `3x00000000000000000000FF`

Update `TURNSTILE_SITEKEY` in `frontend/src/components/TurnstileWidget.tsx` for local dev.

## Debugging Failed Tests

```bash
# View HTML report after test run
npx playwright show-report

# Debug specific test
npx playwright test --debug tests/fraud-stress-test.spec.ts

# Run single test by name
npx playwright test -g "should detect and block rapid submissions"

# Run with trace viewer
npx playwright test --trace on
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml example
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run basic tests
  run: npm run test:basic
  env:
    TEST_URL: https://form.erfi.dev

- name: Run fraud stress tests
  run: npm run test:fraud
  env:
    TEST_URL: https://form.erfi.dev
  # Allow fraud tests to "fail" if too many requests blocked
  continue-on-error: true
```

## Writing New Tests

Follow patterns in existing tests:
- Use helper functions for common actions (`fillForm`)
- Capture and analyze response statuses
- Log detailed results with console output
- Check both positive and negative cases
- Clean up contexts/pages after use

**For fraud tests:**
- Expect some failures/blocks (that's success!)
- Use timeouts for potentially slow operations
- Track metrics (success/blocked/failed counts)
- Test should verify mitigations work, not that all requests succeed

## Performance Considerations

**Fraud tests generate real data:**
- Each test creates actual database entries
- Analytics will show test submissions
- May trigger real alerts/monitoring

**Recommendation:**
- Run fraud tests sparingly
- Monitor production during test runs
- Consider separate test environment for aggressive testing
- Clean up test data periodically via analytics API

## Safety

These tests are designed to **verify security works**, not to harm the system:
- Tests use recognizable test data (`test@example.com`, etc.)
- Reasonable submission counts (20-50 per test)
- Proper cleanup between test runs
- Timeouts prevent runaway tests

If fraud detection is working properly, the system should block most malicious patterns automatically.
