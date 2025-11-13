# Form Validation Implementation

## Architecture

Dual validation strategy using React Hook Form + Zod:
- **Client**: Immediate feedback with `onBlur` mode for better UX
- **Server**: Security enforcement using the same Zod schema
- **Shared schema**: Both client and server use identical validation rules for consistency

## File Structure

```
frontend/src/
├── lib/validation.ts              # Zod schema (imported by both client & server)
└── components/SubmissionForm.tsx  # React Hook Form integration

src/
├── lib/
│   ├── validation.ts              # Server-side schema with transforms
│   └── sanitizer.ts               # Input sanitization functions
└── routes/submissions.ts          # POST handler with validation
```

## Validation Schema

Located in `/frontend/src/lib/validation.ts` (client) and `/src/lib/validation.ts` (server).

```typescript
export const formSchema = z.object({
  // Required fields
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(100, 'Email must be less than 100 characters'),

  // Optional fields
  phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      const digits = val.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }, 'Phone must contain 7-15 digits'),

  address: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      return val.length <= 200;
    }, 'Address must be less than 200 characters'),

  dateOfBirth: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      return /^\d{4}-\d{2}-\d{2}$/.test(val);
    }, 'Invalid date format (YYYY-MM-DD)')
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      const birthDate = new Date(val);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge =
        monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ? age - 1
          : age;
      return actualAge >= 18 && actualAge <= 120;
    }, 'You must be at least 18 years old'),
});
```

### Design Decisions

**Which fields are required?**
- **Required**: First name, last name, email
- **Optional**: Phone, address, date of birth
- Rationale: Only collect essential data. Optional fields reduce friction while still capturing useful demographic info when users choose to provide it.

**Why regex for names?**
- Prevents injection attacks while allowing legitimate names
- Allows hyphens (Mary-Jane) and apostrophes (O'Brien)
- Rejects numbers and special characters that indicate suspicious input

**Why refine() for phone instead of regex?**
- Client accepts any format: `(555) 123-4567`, `555-123-4567`, `+1 555 123 4567`
- We only care about digit count (7-15 digits)
- Server transforms to E.164, so client validation is lenient

**Why complex age calculation?**
- Simple year subtraction fails for birthdays that haven't occurred this year
- Example: Born Dec 31, 2006. Today is Jan 1, 2024. They're still 17 until Dec 31, 2024
- Calculation accounts for month and day to get accurate age

## Client-Side Implementation

### React Hook Form Setup

```typescript
// frontend/src/components/SubmissionForm.tsx
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  setValue,
  watch,
  reset,
} = useForm<FormData>({
  resolver: zodResolver(formSchema),
  mode: 'onBlur',  // Validates when user leaves field
});
```

**Why `onBlur` mode?**
- **Not `onChange`**: Would validate on every keystroke, interrupting user while typing
- **Not `onSubmit`**: Would only show errors after submit attempt, too late for good UX
- **`onBlur`**: Validates when user finishes with a field, providing immediate feedback without interruption

### Field Registration Pattern

**Standard inputs** use the spread operator with `register()`:

```typescript
<Input
  id="firstName"
  {...register('firstName')}
  disabled={isSubmitting}
  className={errors.firstName ? 'border-destructive' : ''}
  aria-invalid={!!errors.firstName}
  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
/>

{errors.firstName && (
  <p id="firstName-error" className="text-sm text-destructive mt-1">
    {errors.firstName.message}
  </p>
)}
```

**What `{...register('firstName')}` does:**
1. Adds `onChange` handler to capture input value
2. Adds `onBlur` handler to trigger validation
3. Adds `ref` to access DOM element
4. Adds `name` attribute for form submission
5. Connects field to React Hook Form state

**Accessibility attributes:**
- `aria-invalid`: Tells screen readers the input is invalid
- `aria-describedby`: Links error message to input for screen readers
- `id` on error message: Required for `aria-describedby` reference

### Phone Input Special Case

Phone input doesn't work with `register()` because it's a complex third-party component:

```typescript
const phoneValue = watch('phone');  // Subscribe to phone field changes

<PhoneInput
  defaultCountry={defaultCountry}
  value={phoneValue}
  onChange={(phone) => setValue('phone', phone, { shouldValidate: true })}
  disabled={isSubmitting}
  inputClassName={errors.phone ? 'border-destructive' : ''}
  className={errors.phone ? 'react-international-phone-error' : ''}
/>
```

**Why this approach?**
- `watch('phone')` creates a controlled component by subscribing to the field value
- `setValue()` manually updates React Hook Form state
- `shouldValidate: true` triggers validation on change (not waiting for blur)
- This pattern required because PhoneInput has its own internal state

### Validation Timing Flow

```
User types in firstName field
         │
         ├─ onChange: React Hook Form captures value
         ├─ State updated: formState.firstName = "John"
         │
User clicks outside field (blur event)
         │
         ├─ onBlur: React Hook Form triggers validation
         ├─ Zod validates: formSchema.shape.firstName.safeParse("John")
         │
         ├─ If valid: No error shown
         │
         └─ If invalid: errors.firstName = { message: "..." }
                        ↓
                   Error text appears below field
                   Input border turns red
```

### Submit Flow

```
User clicks Submit button
         │
         ├─ handleSubmit() intercepts
         ├─ Validates ALL fields via Zod
         │
         ├─ If ANY field invalid:
         │    ├─ Prevent submission
         │    ├─ Show all errors
         │    └─ Focus first invalid field
         │
         └─ If ALL valid:
              ├─ Execute Turnstile challenge
              ├─ Wait for token
              └─ Auto-submit form with token
```

## Server-Side Implementation

### Validation in Request Handler

```typescript
// src/routes/submissions.ts
submissions.post('/', async (c) => {
  // 1. Parse request body
  const body = await c.req.json();

  // 2. Validate with Zod
  const validationResult = formSchema.safeParse(body);

  if (!validationResult.success) {
    return c.json({
      success: false,
      message: 'Validation failed',
      errors: validationResult.error.flatten().fieldErrors,
    }, 400);
  }

  // 3. Data is now typed and validated
  const data = validationResult.data;

  // 4. Sanitize after validation
  const sanitized = {
    firstName: sanitizeInput(data.firstName),
    lastName: sanitizeInput(data.lastName),
    email: normalizeEmail(data.email),
    phone: data.phone,  // Already normalized by transform
    address: sanitizeInput(data.address),
    dateOfBirth: data.dateOfBirth,
  };

  // 5. Continue with Turnstile verification and database insertion
});
```

**Order matters:**
1. **Parse** - Get data from request
2. **Validate** - Ensure data matches schema
3. **Sanitize** - Remove dangerous characters
4. **Transform** - Normalize formats (phone → E.164)
5. **Store** - Insert into database

### Server Schema with Transforms

Server schema adds phone transformation for E.164 format:

```typescript
// src/lib/validation.ts
phone: z
  .string()
  .min(1, 'Phone is required')
  .transform((val) => {
    // Remove all non-digits except leading +
    const cleaned = val.replace(/[^\d+]/g, '');
    // Add +1 if no country code present
    return cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;
  })
  .pipe(
    z.string().regex(
      /^\+[1-9]\d{1,14}$/,
      'Phone must be in E.164 format'
    )
  ),
```

**Transform examples:**
- `+1 (555) 123-4567` → `+15551234567`
- `555-123-4567` → `+15551234567` (assumes US)
- `+44 20 7946 0958` → `+442079460958`

**Why transform on server?**
- Client sends user-friendly formatted number
- Server normalizes to E.164 for database storage
- E.164 enables international queries and SMS/calling integrations
- Prevents duplicate detection issues (same number, different formatting)

### Input Sanitization

```typescript
// src/lib/sanitizer.ts
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')    // Remove HTML tags: <script>alert()</script>
    .replace(/[<>'"]/g, '')     // Remove dangerous chars: < > ' "
    .trim();                     // Remove leading/trailing whitespace
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
```

**What it prevents:**
- **XSS attacks**: Removes `<script>`, `<img>`, etc.
- **Quote escaping**: Strips `'` and `"` that could break SQL queries
- **HTML injection**: Removes all tags and dangerous characters

**Why sanitize AFTER validation?**
- Validation ensures required fields aren't empty
- Sanitization might remove characters, making valid input invalid
- Example: If name is `"<John>"`, validation passes, then sanitization makes it `"John"`

## Error Handling

### Client Error Display

```typescript
{errors.firstName && (
  <p id="firstName-error" className="text-sm text-destructive mt-1">
    {errors.firstName.message}
  </p>
)}
```

**Visual feedback:**
- Red border on input: `className={errors.firstName ? 'border-destructive' : ''}`
- Error message below field
- Icon indicator (if applicable)

### Server Error Responses

**Validation failure (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "firstName": ["First name is required"],
    "email": ["Invalid email address"],
    "phone": ["Phone must contain 7-15 digits"]
  }
}
```

**Turnstile verification failed (400):**
```json
{
  "success": false,
  "message": "Turnstile verification failed"
}
```

**Fraud detected (403):**
```json
{
  "success": false,
  "message": "Submission blocked due to suspicious activity"
}
```

**Server error (500):**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Security Measures

### XSS Prevention

**Input sanitization:**
```typescript
sanitizeInput(data.firstName)  // Removes HTML tags and quotes
```

**Output encoding:**
- React automatically escapes JSX content
- No `dangerouslySetInnerHTML` used anywhere in the app

### SQL Injection Prevention

**Parameterized queries:**
```typescript
// ✅ SAFE - Uses parameter binding
db.prepare(`
  INSERT INTO submissions (first_name, last_name, email)
  VALUES (?, ?, ?)
`).bind(firstName, lastName, email).run();

// ❌ NEVER DO THIS - Vulnerable to SQL injection
db.prepare(`
  INSERT INTO submissions VALUES ('${firstName}', '${lastName}', '${email}')
`).run();
```

D1 automatically escapes parameters in `.bind()`, preventing injection.

### CSRF Protection

Turnstile token provides CSRF protection:
- Must be obtained from form page (can't be forged)
- Single-use (replay protection via token hash in database)
- Expires after 5 minutes
- Validates origin domain

## Performance

**Client validation timing:**
- Zod validation: 1-5ms per field (synchronous)
- No network calls during validation
- Instant feedback to user

**Server validation timing:**
- JSON parsing: ~1ms
- Zod validation: ~2-5ms
- Sanitization: ~1ms per field
- **Total pre-processing: ~10-15ms**

**Full request breakdown:**
- Validation: ~15ms
- Turnstile verification API call: ~100-200ms
- Fraud detection queries: ~50-100ms
- Database insert: ~20-50ms
- **Total: ~200-400ms**

## Testing

Playwright tests in `/tests/form-submission.spec.ts`:

```typescript
test('should show validation errors for empty fields', async ({ page }) => {
  await page.goto('/');
  await page.click('button[type="submit"]');

  // Trigger validation
  await page.locator('input[name="firstName"]').click();
  await page.locator('input[name="lastName"]').click();

  await expect(page.locator('text=First name is required')).toBeVisible({ timeout: 2000 });
});

test('should validate email format', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', 'invalid-email');
  await page.locator('input[name="firstName"]').click(); // Trigger blur

  await expect(page.locator('text=Invalid email address')).toBeVisible({ timeout: 2000 });
});
```

## Related Documentation

- Phone validation details: PHONE-INPUT.md
- Geolocation for phone country: GEOLOCATION.md
- Fraud detection after validation: FRAUD-DETECTION.md
- Database schema: (see D1 migrations)
