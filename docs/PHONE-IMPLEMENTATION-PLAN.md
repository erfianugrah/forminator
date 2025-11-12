# Custom Phone Input Implementation Plan

## Goal

Replace react-international-phone with lightweight custom implementation.

**Benefits:**
- Reduce bundle from ~50KB to ~10-15KB (70% smaller)
- No external dependencies or CDN issues
- Full styling control (no dark mode hacks)
- Simpler maintenance

## Architecture

Three components + one data file:

```
frontend/src/components/phone/
├── PhoneInput.tsx           # Main component (combines CountrySelect + input)
├── CountrySelect.tsx        # Dropdown with search
├── countries.ts             # Country data (~15KB)
└── formatting.ts            # Optional client-side formatting utils
```

## Component Design

### 1. CountrySelect Component

**Props:**
```typescript
interface CountrySelectProps {
  value: string;              // ISO code: 'us'
  onChange: (code: string, dialCode: string) => void;
  disabled?: boolean;
}
```

**Features:**
- Dropdown with search filter
- Display: flag emoji + country name + dial code
- Keyboard navigation (arrow keys, Enter, Escape)
- Virtualized list for performance (optional)

**Implementation:**
- Use shadcn/ui Popover + Command components
- Already have styling system
- Search built into Command component

### 2. PhoneInput Component

**Props:**
```typescript
interface PhoneInputProps {
  value: string;              // Full phone: '+15551234567' or formatted
  onChange: (phone: string) => void;
  defaultCountry?: string;    // ISO code from geolocation
  disabled?: boolean;
  error?: boolean;
}
```

**Layout:**
```
┌─────────────┬──────────────────────────┐
│ 🇺🇸 +1  ▼  │  (555) 123-4567         │
└─────────────┴──────────────────────────┘
```

**State management:**
```typescript
const [country, setCountry] = useState(defaultCountry);
const [dialCode, setDialCode] = useState('+1');

const handleCountryChange = (code: string, dial: string) => {
  setCountry(code);
  setDialCode(dial);
  // Reformat number with new dial code
};
```

### 3. Country Data

**File:** `countries.ts`

**Format:**
```typescript
export interface Country {
  code: string;      // 'us'
  name: string;      // 'United States'
  dial: string;      // '+1'
  emoji: string;     // '🇺🇸'
  format?: string;   // '(###) ###-####' (optional)
}

export const countries: Country[] = [
  { code: 'us', name: 'United States', dial: '+1', emoji: '🇺🇸', format: '(###) ###-####' },
  { code: 'gb', name: 'United Kingdom', dial: '+44', emoji: '🇬🇧' },
  { code: 'nl', name: 'Netherlands', dial: '+31', emoji: '🇳🇱' },
  // ... ~200 more
];
```

**Size estimate:**
- 200 countries × ~75 bytes avg = ~15KB uncompressed
- Gzips to ~5-7KB

**Data source:** Use existing data from react-international-phone or libphonenumber

### 4. Formatting Utilities

**File:** `formatting.ts`

**Optional** - server handles E.164 normalization anyway.

If implemented:
```typescript
export function formatPhone(value: string, country: Country): string {
  if (!country.format) return value;
  // Apply format mask like (###) ###-####
  // Simple implementation: ~20 lines
}

export function stripFormatting(value: string): string {
  return value.replace(/[^\d+]/g, '');
}
```

## Integration with Form

```typescript
// SubmissionForm.tsx
const phoneValue = watch('phone');
const [phoneCountry, setPhoneCountry] = useState(defaultCountry);

<PhoneInput
  value={phoneValue}
  defaultCountry={defaultCountry}
  onChange={(phone) => {
    setValue('phone', phone, { shouldValidate: true });
  }}
  error={!!errors.phone}
  disabled={isSubmitting}
/>
```

## Styling

Uses existing shadcn/ui components:
- Popover for dropdown
- Command for searchable list
- Input for text field
- All dark mode handled automatically

**No custom CSS needed** beyond basic layout flexbox.

## Migration Steps

1. **Create country data file** (~30min)
   - Export data from react-international-phone or find open-source list
   - Format as TypeScript const
   - Include emoji, dial code, name

2. **Build CountrySelect** (~1 hour)
   - Use shadcn/ui Popover + Command
   - Add search functionality
   - Handle keyboard navigation

3. **Build PhoneInput** (~45min)
   - Combine CountrySelect + Input
   - Handle dial code prefix
   - Wire up onChange handler

4. **Add optional formatting** (~30min, if desired)
   - Basic mask for US/common formats
   - Not critical since server normalizes

5. **Replace in SubmissionForm** (~15min)
   - Swap component
   - Update imports
   - Test functionality

6. **Remove old library** (~5min)
   - `npm uninstall react-international-phone`
   - Delete `phone-input.css`
   - Update bundle

**Total estimated time:** 2-3 hours

## Testing Checklist

- [ ] Country detection works on page load
- [ ] Dropdown search filters countries
- [ ] Keyboard navigation (arrows, Enter, Esc)
- [ ] Phone input accepts numbers
- [ ] Changing country updates dial code
- [ ] Form validation still works
- [ ] Dark mode displays correctly
- [ ] Accessible (screen reader, keyboard only)
- [ ] Mobile responsive
- [ ] Server E.164 normalization works

## Benefits vs Current

| Feature | react-international-phone | Custom |
|---------|---------------------------|--------|
| Bundle size | ~50KB | ~10-15KB |
| CDN deps | Yes (flags) | No |
| Dark mode | Custom CSS hacks | Native shadcn/ui |
| Customization | Limited | Full control |
| Maintenance | External updates | Internal |
| Height issues | Requires fixes | Native match |
| Type safety | Good | Excellent |

## Risks & Mitigations

**Risk:** Missing edge cases in formatting
- **Mitigation:** Server handles normalization, client formatting is UX only

**Risk:** Country data becomes stale
- **Mitigation:** ISO codes rarely change, can update annually

**Risk:** Accessibility issues
- **Mitigation:** Use shadcn/ui components (already accessible)

**Risk:** Takes longer than estimated
- **Mitigation:** Can fall back to current implementation, no rush

## Future Enhancements

Once basic version works:

1. **Smart defaults:** Popular countries at top
2. **Recent countries:** Remember last used
3. **Validation hints:** Show format example per country
4. **Flag sprite sheet:** Further optimize bundle (optional)
5. **Region support:** Sub-regions for US/CA/others

## Decision

Recommend implementing custom version. The current library is overkill for our needs, and we're already fighting its defaults (CDN, styling, size). Custom implementation gives us full control with minimal code.

**Next step:** Start with country data extraction and CountrySelect component.
