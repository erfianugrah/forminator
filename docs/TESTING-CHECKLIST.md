# Testing Checklist - Recent Changes (2025-11-13)

This document provides comprehensive testing procedures for the recent fraud detection and optional fields updates.

## ✅ Changes to Test

### 1. Strengthened Fraud Detection (Commit: 8fcfd88)
- Multi-layer detection system with D1 eventual consistency handling
- Stricter thresholds for registration forms
- Validation attempt tracking

### 2. Optional Form Fields (Commit: 4fa84b5)
- Phone, address, and date of birth are now optional
- Enhanced DOB picker UI
- Database migration applied

---

## Test Suite 1: Fraud Detection

### Test 1.1: Single Submission (Should Succeed)
**Objective**: Verify legitimate user can submit once

**Steps**:
1. Navigate to https://form.erfi.dev
2. Fill in all required fields (first name, last name, email)
3. Complete Turnstile challenge
4. Submit form

**Expected Result**:
- ✅ Form submits successfully
- ✅ Success message displayed
- ✅ Submission recorded in database

---

### Test 1.2: Duplicate Submission - Same Ephemeral ID (Should Block)
**Objective**: Verify fraud detection blocks 2nd submission within 24h

**Steps**:
1. Submit form successfully (Test 1.1)
2. Wait for success message
3. Refresh page
4. Fill in form with DIFFERENT email/data
5. Complete Turnstile challenge
6. Submit form

**Expected Result**:
- ❌ Form submission blocked with **429 Too Many Requests**
- ❌ Error message: "Please try again later" or similar
- ❌ `Retry-After: 3600` header present
- ✅ Ephemeral ID auto-blacklisted in `fraud_blacklist` table
- ✅ Risk score = 100 logged

**Why This Works**:
- Browser retains same ephemeral ID across page refreshes
- Layer 1 detects 2+ submissions within 24h
- Blocks immediately (effectiveCount = 2)

---

### Test 1.3: Rapid Validation Attempts (Should Block)
**Objective**: Verify Layer 2 catches rapid-fire attacks before D1 replication

**Steps**:
1. Open browser DevTools > Network tab
2. Submit form 3 times rapidly (within seconds)
3. Observe responses

**Expected Result**:
- ✅ 1st submission: Success (200 OK)
- ⚠️ 2nd submission: May succeed or fail (depends on D1 replication timing)
- ❌ 3rd submission: Blocked (429 Too Many Requests)
- ✅ Layer 2 detects 3+ validation attempts in 1h
- ✅ `turnstile_validations` table shows all 3 attempts

**Database Check**:
```sql
-- Check validation attempts
SELECT COUNT(*) as validation_count, ephemeral_id
FROM turnstile_validations
WHERE created_at > datetime('now', '-1 hour')
GROUP BY ephemeral_id;

-- Should show 3 validations for the ephemeral ID
```

---

### Test 1.4: IP Diversity Detection (Should Block)
**Objective**: Verify proxy rotation detection

**Steps**:
1. Submit form successfully from Location A (VPN off)
2. Enable VPN to change IP
3. Submit form with same browser (same ephemeral ID, different IP)

**Expected Result**:
- ❌ 2nd submission blocked (429 Too Many Requests)
- ✅ Layer 3 detects 2+ unique IPs for same ephemeral ID
- ✅ Risk score = 100
- ✅ Logged as "Multiple IPs for same ephemeral ID"

**Database Check**:
```sql
SELECT COUNT(DISTINCT remote_ip) as ip_count, ephemeral_id
FROM submissions
WHERE ephemeral_id = 'x:YOUR_EPHEMERAL_ID'
AND created_at > datetime('now', '-24 hours');

-- Should show 2 unique IPs
```

---

### Test 1.5: Blacklist Persistence (Should Block Immediately)
**Objective**: Verify blacklisted ephemeral IDs are blocked without Turnstile call

**Steps**:
1. Get blacklisted (trigger any of the above blocks)
2. Wait 10 seconds
3. Try to submit again

**Expected Result**:
- ❌ Blocked BEFORE Turnstile validation (~10ms response time)
- ❌ 403 Forbidden (from Layer 1 pre-validation check)
- ✅ No Turnstile API call made (check worker logs)

**Worker Logs**:
```bash
wrangler tail
# Should see: "Ephemeral ID/IP found in blacklist, blocking"
# Should NOT see: "Validating Turnstile token"
```

---

### Test 1.6: IP-Based Fallback (No Ephemeral ID)
**Objective**: Verify IP-based fraud detection when ephemeral ID unavailable

**Prerequisites**: Use a non-Enterprise Turnstile widget (no ephemeral ID)

**Steps**:
1. Submit form 3 times from same IP within 1 hour
2. Observe responses

**Expected Result**:
- ✅ 1st & 2nd submissions: Success
- ❌ 3rd submission: Blocked (429)
- ✅ IP-based threshold triggered

---

## Test Suite 2: Optional Form Fields

### Test 2.1: Submit with Only Required Fields
**Objective**: Verify optional fields can be left empty

**Steps**:
1. Navigate to https://form.erfi.dev
2. Fill in ONLY:
   - First name
   - Last name
   - Email
3. Leave EMPTY:
   - Phone
   - Address
   - Date of birth
4. Complete Turnstile challenge
5. Submit form

**Expected Result**:
- ✅ Form validates successfully
- ✅ Submission created with NULL values for optional fields
- ✅ No validation errors displayed

**Database Check**:
```sql
SELECT first_name, last_name, email, phone, address, date_of_birth
FROM submissions
ORDER BY created_at DESC LIMIT 1;

-- phone, address, date_of_birth should be NULL
```

---

### Test 2.2: Submit with All Fields
**Objective**: Verify optional fields work when provided

**Steps**:
1. Fill in ALL fields including optional ones
2. Submit form

**Expected Result**:
- ✅ Form validates successfully
- ✅ All fields stored in database (including optional ones)

---

### Test 2.3: Invalid Optional Field Format
**Objective**: Verify validation still applies to optional fields when provided

**Steps**:
1. Fill required fields
2. Enter invalid phone: "abc" (letters only)
3. Try to submit

**Expected Result**:
- ❌ Validation error: "Phone must contain 7-15 digits"
- ❌ Form does not submit

**Repeat for**:
- Address > 200 characters → "Address must be less than 200 characters"
- DOB with age < 18 → "You must be at least 18 years old"

---

### Test 2.4: DOB Picker UI
**Objective**: Verify enhanced DOB picker styling and functionality

**Steps**:
1. Navigate to form
2. Inspect DOB picker (Month/Day/Year dropdowns)

**Visual Checks**:
- ✅ ChevronDown icons visible on all 3 dropdowns
- ✅ Rounded corners (rounded-lg)
- ✅ Label shows "(Optional)" in gray
- ✅ Hover state changes background color
- ✅ Select boxes have consistent height (h-11)
- ✅ Dark mode: proper contrast and visibility

**Functional Checks**:
- ✅ Month dropdown: 12 months listed
- ✅ Day dropdown: Disabled until month selected
- ✅ Day count adjusts based on month (e.g., Feb has 28/29 days)
- ✅ Year dropdown: Shows 1900 to (current year - 18)
- ✅ Selecting all 3 populates YYYY-MM-DD format

---

### Test 2.5: Empty Optional Fields Don't Trigger Validation
**Objective**: Verify empty optional fields pass validation

**Steps**:
1. Fill required fields
2. Click into phone field, then click out (blur event)
3. Observe validation

**Expected Result**:
- ✅ No validation error shown
- ✅ Field accepts empty value

---

## Test Suite 3: Database Migration

### Test 3.1: Verify Schema Changes
**Objective**: Confirm database schema allows NULL for optional fields

**SQL**:
```sql
-- Check table schema
SELECT sql FROM sqlite_master
WHERE type='table' AND name='submissions';

-- Verify: phone TEXT, address TEXT, date_of_birth TEXT
-- (no NOT NULL constraint)
```

**Expected Output**:
```
phone TEXT,
address TEXT,
date_of_birth TEXT,
```

---

### Test 3.2: Verify Existing Data Integrity
**Objective**: Ensure migration didn't corrupt existing submissions

**SQL**:
```sql
-- Count submissions before migration
SELECT COUNT(*) as before_count FROM submissions_old; -- If still exists

-- Count submissions after migration
SELECT COUNT(*) as after_count FROM submissions;

-- Verify all data copied
SELECT * FROM submissions ORDER BY created_at DESC LIMIT 10;
```

**Expected Result**:
- ✅ Row counts match
- ✅ All fields intact (no data loss)
- ✅ Old table dropped (submissions_old should not exist)

---

### Test 3.3: Verify Indexes Recreated
**Objective**: Confirm indexes were recreated after migration

**SQL**:
```sql
SELECT name, sql FROM sqlite_master
WHERE type='index' AND tbl_name='submissions';
```

**Expected Indexes**:
- idx_ephemeral_id
- idx_created_at
- idx_email
- idx_country
- idx_ja3_hash
- idx_ja4
- idx_bot_score

---

## Test Suite 4: API-Level Testing

### Test 4.1: POST /api/submissions - Valid Payload (Minimal)
```bash
curl -X POST https://form.erfi.dev/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "turnstileToken": "VALID_TOKEN_HERE"
  }'
```

**Expected**: 200 OK, submission created

---

### Test 4.2: POST /api/submissions - Valid Payload (Full)
```bash
curl -X POST https://form.erfi.dev/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+1 555 123 4567",
    "address": "123 Main St, City, State 12345",
    "dateOfBirth": "1990-05-15",
    "turnstileToken": "VALID_TOKEN_HERE"
  }'
```

**Expected**: 200 OK, all fields stored

---

### Test 4.3: POST /api/submissions - Missing Required Field
```bash
curl -X POST https://form.erfi.dev/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "email": "john@example.com",
    "turnstileToken": "VALID_TOKEN_HERE"
  }'
```

**Expected**: 400 Bad Request, "Last name is required"

---

### Test 4.4: POST /api/submissions - Invalid Optional Field
```bash
curl -X POST https://form.erfi.dev/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "invalid-phone",
    "turnstileToken": "VALID_TOKEN_HERE"
  }'
```

**Expected**: 400 Bad Request, "Phone must contain 7-15 digits"

---

## Test Suite 5: Analytics Dashboard

### Test 5.1: Verify Submissions Display Correctly
**Objective**: Ensure analytics handles NULL optional fields

**Steps**:
1. Navigate to https://form.erfi.dev/analytics
2. View recent submissions table

**Expected Result**:
- ✅ Submissions with empty optional fields display gracefully (show "-" or blank)
- ✅ No JavaScript errors in console
- ✅ Filters work correctly

---

## Manual Regression Testing

### Critical Paths to Re-Test
1. ✅ Normal form submission flow (with Turnstile)
2. ✅ Form validation errors display correctly
3. ✅ Phone input country selector works
4. ✅ Analytics dashboard loads and displays data
5. ✅ Dark mode switching
6. ✅ Mobile responsiveness

---

## Performance Testing

### Fraud Detection Performance
**Objective**: Verify Layer 1 blacklist lookup is fast

**Test**:
```bash
# Time 10 blocked requests (blacklisted ephemeral ID)
for i in {1..10}; do
  time curl -X POST https://form.erfi.dev/api/submissions \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Test","lastName":"User","email":"test@example.com","turnstileToken":"BLACKLISTED_TOKEN"}'
done
```

**Expected**: Response time < 50ms (avg ~10ms for blacklist lookup)

---

## Deployment Verification

### Check Deployed Versions
```bash
# Check current version
curl -I https://form.erfi.dev

# Verify worker version
# Version ID: 656df58d-7d92-4030-8a73-c93480aee081 (current)
```

### Verify Production Database
```bash
wrangler d1 execute DB --command="SELECT COUNT(*) FROM submissions" --remote
wrangler d1 execute DB --command="SELECT COUNT(*) FROM fraud_blacklist" --remote
```

---

## Success Criteria Summary

### Fraud Detection
- [x] Blocks 2nd submission within 24h
- [x] Blocks 3+ validation attempts within 1h
- [x] Blocks 2+ IPs for same ephemeral ID
- [x] Blacklist lookup < 50ms
- [x] Auto-blacklisting works (7-day expiry for risk=100)

### Optional Fields
- [x] Required fields validated strictly
- [x] Optional fields can be empty
- [x] Optional fields validated when provided
- [x] Database allows NULL for optional fields
- [x] Migration applied successfully (no data loss)
- [x] DOB picker UI enhanced

### Documentation
- [x] CLAUDE.md updated
- [x] docs/FRAUD-DETECTION.md updated
- [x] docs/FORM-VALIDATION.md updated
- [x] Testing checklist created

---

## Rollback Plan (If Needed)

### Fraud Detection Issues
If fraud detection is too aggressive:
1. Adjust thresholds in `src/lib/turnstile.ts`
2. Increase threshold from 2 to 3 submissions
3. Redeploy: `npm run deploy`

### Optional Fields Issues
If required fields needed again:
1. Update validation schemas to remove `.optional()`
2. Apply reverse migration (add NOT NULL constraints)
3. Update form UI to remove "(Optional)" labels

### Emergency Rollback
```bash
# Revert to previous version
git revert 4fa84b5 8fcfd88
npm run deploy
```

---

## Notes

- **Test Environment**: Production (https://form.erfi.dev)
- **Database**: Remote D1 (32b62f8d-14ad-48cf-9464-7fc4b154a4f3)
- **Deployed Version**: 656df58d-7d92-4030-8a73-c93480aee081
- **Test Date**: 2025-11-13

**Recommended**: Run automated tests via Playwright for comprehensive coverage.
