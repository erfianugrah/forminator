# Phone Input Implementation

## Current Library

**react-international-phone v4.6.0**
- 200+ countries with dial codes
- Auto-formatting per country
- ~50KB gzipped (large)
- Has CDN dependencies for flags (hidden via CSS)

## Implementation

### Country Auto-Detection

Backend endpoint reads Cloudflare's `CF-IPCountry` header:

```typescript
// src/routes/geo.ts
geo.get('/', (c) => {
  const countryCode = c.req.header('CF-IPCountry') || 'US';
  return c.json({ success: true, countryCode: countryCode.toLowerCase() });
});
```

Frontend fetches on mount:

```typescript
// frontend/src/components/SubmissionForm.tsx
const [defaultCountry, setDefaultCountry] = useState<CountryIso2>('us');

useEffect(() => {
  fetch('/api/geo')
    .then(r => r.json())
    .then(data => setDefaultCountry(data.countryCode));
}, []);
```

Timing: ~100ms from page load to country detection.

### Component Usage

```typescript
<PhoneInput
  defaultCountry={defaultCountry}  // Auto-detected
  value={phoneValue}
  onChange={(phone) => setValue('phone', phone, { shouldValidate: true })}
  flagComponent={({ iso2 }) => {
    const country = parseCountry(defaultCountries.find(c => c[1] === iso2));
    return <span>{country?.emoji || '🌐'}</span>;
  }}
/>
```

### Phone Format Flow

**Client sends:** `+1 (555) 123-4567` (formatted)
**Server transforms:** `+15551234567` (E.164)
**Database stores:** `+15551234567`

Server transform (in Zod schema):

```typescript
phone: z.string()
  .transform(val => {
    const cleaned = val.replace(/[^\d+]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;
  })
  .pipe(z.string().regex(/^\+[1-9]\d{1,14}$/))
```

## Dark Mode Styling

Custom CSS overrides to use shadcn/ui variables:

```css
/* frontend/src/styles/phone-input.css */
.react-international-phone-input {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--input));
}

.react-international-phone-country-selector-dropdown {
  background-color: hsl(var(--popover));
  color: hsl(var(--popover-foreground));
}

/* Hide CDN-loaded flag images */
.react-international-phone-flag-emoji[src*="cdnjs"] {
  display: none !important;
}
```

Flags now use Unicode emojis via `flagComponent` prop instead of CDN SVGs.

## Known Issues

1. **Large bundle** (~50KB) for simple phone input
2. **CDN dependencies** for flags (mitigated with CSS + flagComponent)
3. **Complex styling** required for dark mode integration
4. **Height inconsistencies** with form inputs (fixed with explicit min/max heights)

## Planned Replacement

Custom implementation planned (see PHONE-IMPLEMENTATION-PLAN.md):
- ~10-15KB bundle
- No external dependencies
- Simple country dropdown + text input
- Full styling control
- Unicode emoji flags bundled

## Related

- Server E.164 normalization: FORM-VALIDATION.md
- Geolocation API: GEOLOCATION.md
- Custom implementation: PHONE-IMPLEMENTATION-PLAN.md (to be created)
