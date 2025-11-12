# Geolocation Implementation

## Overview

Uses Cloudflare's built-in geolocation - no external APIs needed.

**Purpose:**
- Auto-detect user's country for phone input
- Collect geographic metadata for submissions
- Enable country-based analytics

## How It Works

Cloudflare adds `CF-IPCountry` header to every request based on client IP.

**Header format:** ISO 3166-1 alpha-2 (2 letters, uppercase)
- Examples: `US`, `GB`, `NL`, `AU`, `JP`
- Special: `XX` (unknown), `T1` (Tor), `A1` (proxy), `A2` (satellite)

## Backend API

```typescript
// src/routes/geo.ts
geo.get('/', (c) => {
  const countryCode = c.req.header('CF-IPCountry') || 'US';
  return c.json({
    success: true,
    countryCode: countryCode.toLowerCase(), // react-international-phone expects lowercase
  });
});
```

**Response:**
```json
{
  "success": true,
  "countryCode": "nl"
}
```

## Frontend Integration

```typescript
// frontend/src/components/SubmissionForm.tsx
const [defaultCountry, setDefaultCountry] = useState<CountryIso2>('us');

useEffect(() => {
  fetch('/api/geo')
    .then(r => r.json())
    .then(data => setDefaultCountry(data.countryCode))
    .catch(() => {/* silently fallback to 'us' */});
}, []);
```

**Timing:** ~100-150ms from page load to country detection

**UX Flow:**
1. Page loads with US flag (10ms)
2. After ~100ms, updates to user's country
3. No loading spinner needed (smooth transition)

## Extended Geolocation Data

Cloudflare provides more than just country via `request.cf`:

```typescript
const cf = c.req.raw.cf;
// Available: country, region, city, postalCode, timezone,
//            latitude, longitude, continent, asn, colo
```

Currently only using `country` for phone input. Extended data stored with submissions for analytics.

## Accuracy

- **Country**: ~95-99% accurate (very reliable)
- **Region/State**: ~80-90%
- **City**: ~70-80% (±50km typical)
- **Postal code**: ~50-70% (least reliable)

## Limitations

**VPNs/Proxies:**
- Shows VPN country, not user's actual country
- Detected as `A1` (anonymous proxy)
- Mitigation: Allow manual country selection

**Mobile Networks:**
- Often geolocates to carrier HQ, not user location
- Country usually still correct
- City/region unreliable

**Tor:**
- Shows exit node country
- Detected as `T1`
- Respect privacy choice

## Testing

**Production:**
```bash
curl https://form.erfi.dev/api/geo
# Returns your actual country
```

**With VPN:**
Connect to VPN in different country, then test - should return VPN's country.

**Development:**
```bash
# Mock in wrangler dev
curl http://localhost:8787/api/geo -H "CF-IPCountry: JP"
```

## Related

- Phone input usage: PHONE-INPUT.md
- Submission metadata collection: API-REFERENCE.md
- Analytics by country: (analytics implementation)
