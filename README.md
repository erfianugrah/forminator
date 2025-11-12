# Cloudflare Turnstile Flow Demo

Full-stack Turnstile demo with Astro frontend, Cloudflare Workers backend (Hono), D1 database, and comprehensive fraud detection using Bot Management signals.

## Architecture

```
turnstile-flow/
├── frontend/              # Astro static site (UI only)
│   ├── src/
│   │   ├── components/   # React components (shadcn/ui)
│   │   ├── layouts/      # Astro layouts
│   │   ├── pages/        # Static pages (NO API routes)
│   │   └── styles/       # CSS
│   └── package.json
│
├── src/                   # Cloudflare Worker (Backend)
│   ├── index.ts          # Hono app + asset serving
│   ├── routes/           # API routes (submissions, analytics)
│   └── lib/              # Business logic (Turnstile, D1, validation)
│
├── wrangler.jsonc        # Worker configuration
├── package.json          # Worker dependencies
└── schema.sql            # D1 database schema
```

## Features

### Security & Fraud Detection
- **Turnstile Integration**: Explicit rendering with interaction-only appearance
- **Single-step Validation**: Token validation + fraud check + submission in one atomic operation
- **Token Replay Protection**: SHA256 hashing with unique index
- **Ephemeral ID Fraud Detection**: Pattern recognition over 7-day window (Enterprise)
- **IP-based Fallback**: Fraud detection when ephemeral ID unavailable
- **SQL Injection Prevention**: Parameterized queries with whitelisting
- **Input Sanitization**: HTML stripping and normalization

### Rich Metadata Collection
Captures 40+ fields from `request.cf` and headers:
- **Geographic**: Country, region, city, postal code, lat/long, timezone
- **Network**: ASN, AS organization, colo, HTTP protocol, TLS version/cipher
- **Bot Management**: Bot score, client trust score, verified bot flag, JS detection
- **Fingerprints**: JA3 hash, JA4 string, JA4 signals (h2h3_ratio, heuristic_ratio, etc.)
- **Detection**: Detection IDs array from Bot Management

### UI & Analytics
- **Dark Mode**: Full support with shadcn/ui components
- **Real-time Analytics**: Validation stats, submissions, country distribution, bot scores
- **Form Validation**: Client and server-side with Zod schemas

## Quick Start

### Prerequisites
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account with D1 database created

### 1. Install Dependencies

```bash
# Worker (root)
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Set Up D1 Database

```bash
# Create D1 database (if not already created)
wrangler d1 create turnstile-demo

# Note the database_id from the output and update worker/wrangler.jsonc

# Initialize schema
wrangler d1 execute turnstile-demo --file=./schema.sql --remote
```

### 3. Configure Secrets

```bash
# Set secrets for production
wrangler secret put TURNSTILE-SECRET-KEY
wrangler secret put TURNSTILE-SITE-KEY

# For local development, create .dev.vars in root
cat > .dev.vars << EOF
TURNSTILE-SECRET-KEY=your_secret_key_here
TURNSTILE-SITE-KEY=0x4AAAAAACAjw0bmUZ7V7fh2
EOF
```

### 4. Update Configuration

Edit `wrangler.jsonc`:
- Update `database_id` with your D1 database ID
- Verify `routes` section has your custom domain (form.erfi.dev)

### 5. Build & Deploy

```bash
# Build frontend static assets
cd frontend
npm run build
cd ..

# Deploy worker (serves static assets + API)
wrangler deploy
```

## Development

### Local Development with Remote D1

```bash
# Terminal 1: Build frontend (watch mode)
cd frontend
npm run dev

# Terminal 2: Run worker with remote D1 (from root)
cd ..
wrangler dev --remote
```

The `--remote` flag uses your production D1 database for testing. This ensures consistency and avoids local/remote data sync issues.

### Why Remote D1 for Development?

- **Consistency**: Same data as production
- **No sync issues**: Local D1 can drift from remote
- **Realistic testing**: Test with actual Cloudflare infrastructure
- **Easier debugging**: All data in one place

## API Endpoints

### POST /api/submissions
Submit form with Turnstile validation (single-step operation).

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "dateOfBirth": "1990-01-01",
  "turnstileToken": "0.xxx..."
}
```

**Flow:**
1. Extract request metadata (40+ fields from request.cf)
2. Validate form data (Zod schema)
3. Sanitize inputs
4. Hash Turnstile token (SHA256)
5. Check token reuse (D1 lookup)
6. Validate with Turnstile siteverify API
7. Fraud detection (ephemeral ID or IP-based)
8. Create submission in D1
9. Log validation attempt
10. Return success/error

### GET /api/analytics/stats
Get validation statistics.

### GET /api/analytics/submissions
Get recent submissions (supports pagination).

### GET /api/analytics/countries
Get submissions by country.

### GET /api/analytics/bot-scores
Get bot score distribution.

## Database Schema

### submissions (42 fields)
- Form data: first_name, last_name, email, phone, address, date_of_birth
- Geographic: country, region, city, postal_code, timezone, latitude, longitude, continent, is_eu_country
- Network: asn, as_organization, colo, http_protocol, tls_version, tls_cipher
- Bot signals: bot_score, client_trust_score, verified_bot, detection_ids (JSON)
- Fingerprints: ja3_hash, ja4, ja4_signals (JSON)
- Metadata: remote_ip, user_agent, ephemeral_id, created_at

### turnstile_validations (35 fields)
- Validation: token_hash (unique), success, allowed, block_reason, challenge_ts, hostname, action, risk_score
- All request metadata fields (same as submissions)
- Foreign key: submission_id

### Indexes
- Unique: token_hash
- Performance: ephemeral_id, created_at, email, country, ja3_hash, ja4, bot_score

## Fraud Detection Algorithm

### Ephemeral ID Check (Preferred)
Checks last 7 days (while ID is likely still active):
- 5+ submissions in 7 days: +30 risk
- 10+ submissions in 7 days: +40 risk
- 10+ validations in 1 hour: +25 risk
- **Block threshold**: 70 risk score

### IP-based Fallback
Checks last hour:
- 3+ submissions in 1 hour: +40 risk
- 5+ submissions in 1 hour: +30 risk
- **Block threshold**: 70 risk score

**Note**: This is pattern-based fraud detection, not strict rate limiting. Turnstile handles primary bot protection. For production-grade strict rate limiting, consider adding Durable Objects.

## Security Notes

### What's Implemented
✅ Single-step validation (no token reuse)
✅ Token replay protection (SHA256 hashing)
✅ Ephemeral ID fraud detection (7-day window)
✅ IP-based fallback fraud detection
✅ SQL injection prevention
✅ Input sanitization
✅ Comprehensive request metadata capture

### What's NOT Implemented (Out of Scope for Demo)
❌ Strict real-time rate limiting (would need Durable Objects)
❌ Advanced bot mitigation beyond Turnstile
❌ Email verification
❌ CSRF tokens (relies on Turnstile)

### Ephemeral IDs & Rate Limiting

**Why no strict rate limiting?**
- Turnstile already limits how fast tokens can be obtained
- Ephemeral IDs help identify rapid patterns post-hoc
- D1 eventual consistency means strict enforcement would need Durable Objects
- Current approach: pattern recognition, not real-time enforcement

**For production:**
If you need strict "max N requests per time window" enforcement, add Durable Objects for strongly-consistent rate limiting.

## Custom Domain Setup

The worker is configured for `form.erfi.dev`. To use your own domain:

1. Update `worker/wrangler.jsonc`:
```jsonc
"routes": [
  {
    "pattern": "your-domain.com",
    "custom_domain": true
  },
  {
    "pattern": "your-domain.com/*",
    "custom_domain": true
  }
]
```

2. In Cloudflare Dashboard:
   - Add custom domain to your Worker
   - Ensure DNS points to Cloudflare

## Troubleshooting

### D1 Database Not Found
```bash
wrangler d1 list
# Verify database_id matches worker/wrangler.jsonc
```

### Secrets Not Loading
Ensure `.dev.vars` exists in `worker/` directory for local development.

### Turnstile Widget Not Loading
1. Check browser console for errors
2. Verify sitekey in `TurnstileWidget.tsx` matches your widget
3. Ensure script tag is present in Layout.astro

### Bot Scores Always Null
Bot Management signals (bot_score, ja3_hash, ja4, detection_ids) require Cloudflare Enterprise with Bot Management enabled.

### Frontend Changes Not Reflecting
```bash
# Rebuild frontend
cd frontend
npm run build

# Redeploy worker
cd ../worker
wrangler deploy
```

## Documentation

Additional planning docs:
- `PLAN.md` - Complete implementation plan and architecture
- `TURNSTILE-IMPLEMENTATION.md` - Turnstile integration strategy
- `EPHEMERAL-ID-STRATEGY.md` - Fraud detection approach
- `SECURITY-FIXES.md` - Security hardening details

## License

MIT
