# End-to-End Tests

Automated browser tests using Playwright to verify form submission, Turnstile integration, and fraud detection.

## Running Tests

```bash
# Install browsers (first time only)
npx playwright install chromium

# Run all tests
npm test

# Run with UI mode (interactive)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run against production
TEST_URL=https://form.erfi.dev npm test
```

## Test Coverage

### Form Submission (`form-submission.spec.ts`)
- Page loads with all form fields
- Client-side validation (empty fields, invalid email, age requirement)
- Phone number auto-detection via geolocation
- Phone number formatting
- Form submission flow
- Turnstile widget loading and triggering

### Ephemeral ID & Fraud Detection (`ephemeral-id.spec.ts`)
- Ephemeral ID tracking in submissions (Enterprise only)
- Analytics queries for fraud metrics
- Rapid submission pattern detection
- Token replay protection
- Multiple user submissions (false positive check)

## Test Configuration

See `playwright.config.ts`:
- Tests run against production URL by default
- Can run against local `wrangler dev` with `TEST_URL=http://localhost:8787`
- Screenshots captured on failure
- Trace recording on first retry

## Notes

### Turnstile Testing Keys

For local testing without solving challenges, use these sitekeys:

- **Always passes**: `1x00000000000000000000AA`
- **Always fails**: `2x00000000000000000000AB`
- **Forces interactive challenge**: `3x00000000000000000000FF`

Update `TURNSTILE_SITEKEY` in `frontend/src/components/TurnstileWidget.tsx`

### Ephemeral ID Testing

Ephemeral IDs require Cloudflare Enterprise with Bot Management. Tests check for:
1. Presence of `unique_ephemeral_ids` metric in analytics
2. Fraud detection patterns based on submission frequency
3. Risk score calculations

Without Enterprise, tests verify fallback to IP-based fraud detection.

### CI/CD Integration

```yaml
# .github/workflows/test.yml example
- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: Run tests
  run: npm test
  env:
    TEST_URL: https://form.erfi.dev
```

## Debugging Failed Tests

```bash
# View HTML report
npx playwright show-report

# Debug specific test
npx playwright test --debug tests/form-submission.spec.ts

# Run single test
npx playwright test -g "should load the form page"
```

## Writing New Tests

Follow patterns in existing tests:
- Use descriptive test names
- Wait for elements with timeouts
- Check both positive and negative cases
- Verify API responses when applicable
- Clean up contexts/pages after use
