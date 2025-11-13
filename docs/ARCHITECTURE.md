# Architecture

## Overview

Forminator is a full-stack Cloudflare Turnstile demonstration showcasing:
- **Frontend**: Astro static site with React components (shadcn/ui) and dark mode
- **Backend**: Cloudflare Worker with Hono routing framework
- **Database**: D1 for storing form submissions with rich metadata (40+ fields)
- **Security**: Single-step Turnstile validation with fraud detection

##

 Project Structure

```
forminator/
├── frontend/                    # Astro static site (UI only)
│   ├── src/
│   │   ├── components/         # React components (shadcn/ui)
│   │   ├── layouts/            # Astro layouts
│   │   ├── pages/              # Astro pages (NO API routes)
│   │   └── styles/             # Global CSS
│   ├── astro.config.mjs
│   └── package.json
│
├── src/                         # Cloudflare Worker (Backend - at root)
│   ├── index.ts                # Hono app entry + asset serving
│   ├── routes/                 # API routes
│   │   ├── submissions.ts      # Form submission endpoint
│   │   └── analytics.ts        # Analytics endpoints
│   └── lib/                    # Business logic
│       ├── turnstile.ts        # Turnstile validation
│       ├── database.ts         # D1 operations
│       ├── validation.ts       # Form validation (Zod)
│       ├── logger.ts           # Pino logging
│       └── types.ts            # TypeScript types
│
├── wrangler.jsonc              # Worker configuration
├── package.json                # Worker dependencies
├── schema.sql                  # D1 database schema
├── docs/                       # Documentation
└── README.md                   # Main readme
```

## Tech Stack

### Frontend
- **Astro 5.x**: Static site generation
- **React 19**: Component framework
- **shadcn/ui**: Copy-paste component library
- **Tailwind CSS 4**: Utility-first CSS
- **Zod**: Client-side validation

### Backend
- **Hono 4.x**: Lightweight routing framework
- **Cloudflare Workers**: Edge compute platform
- **D1**: SQLite at the edge
- **Pino**: Structured logging
- **Zod**: Server-side validation

### Security
- **Turnstile**: CAPTCHA alternative
- **Ephemeral IDs**: Enterprise Bot Management feature
- **Token Replay Protection**: SHA256 hashing
- **Input Sanitization**: XSS prevention
- **Parameterized Queries**: SQL injection prevention

## Request Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Client Browser                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ https://form.erfi.dev/                                  │  │
│  │  • Static Astro pages (UI)                              │  │
│  │  • TurnstileWidget (React component)                    │  │
│  │  • SubmissionForm                                       │  │
│  │  • AnalyticsDashboard                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└───────┬──────────────────────────────────────────────────────┘
        │ POST /api/submissions { ...formData, turnstileToken }
        │
┌───────▼──────────────────────────────────────────────────────┐
│  Cloudflare Worker (form.erfi.dev)                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Hono App (src/index.ts)                                 │  │
│  │  • Serves static assets from /frontend/dist (ASSETS)   │  │
│  │  • Routes /api/* to API handlers                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ POST /api/submissions (Single-Step Validation)         │  │
│  │                                                          │  │
│  │ 1. Extract request metadata (IP, geo, bot signals)      │  │
│  │ 2. Validate form data (Zod schema)                      │  │
│  │ 3. Sanitize inputs (HTML stripping)                     │  │
│  │ 4. Hash Turnstile token (SHA256)                        │  │
│  │ 5. Check token reuse (D1 lookup)                        │  │
│  │ 6. Validate with Turnstile API (siteverify)            │  │
│  │ 7. Fraud detection (ephemeral ID or IP-based)          │  │
│  │ 8. Create submission in D1                              │  │
│  │ 9. Log validation attempt                               │  │
│  │ 10. Return success/error                                │  │
│  └────────────────────────────────────────────────────────┘  │
└───────┬──────────────────────┬───────────────────────────────┘
        │                      │
┌───────▼──────────┐    ┌──────────▼──────────────────────────┐
│ Turnstile API    │    │ D1 Database                          │
│ siteverify       │    │  • submissions (42 fields + metadata)│
│                  │    │  • turnstile_validations (35 fields) │
│ Returns:         │    │                                       │
│ • success        │    │ Rich metadata captured:               │
│ • challenge_ts   │    │  - Geographic (country, city, etc)   │
│ • hostname       │    │  - Network (ASN, colo, TLS)          │
│ • action         │    │  - Bot signals (scores, JA3, JA4)    │
│ • metadata       │    │  - Detection IDs, JA4 signals        │
│   • ephemeral_id │    │  - Request.cf properties             │
└──────────────────┘    └──────────────────────────────────────┘
```

## Key Design Decisions

### 1. Worker at Root Level

The Worker is the main project, with the frontend as a subdirectory:
- `src/` contains Worker code (Hono app, routes, lib)
- `frontend/` contains Astro static site
- Worker serves static assets from `frontend/dist` via ASSETS binding
- Single deploy: `npm run deploy` builds frontend + deploys worker

### 2. Single-Step Validation

**Why Single-Step**: Turnstile tokens are single-use. A two-step flow (separate verify + submit endpoints) would consume the token twice.

**Implementation**:
- Client collects form data + Turnstile token
- Single POST to `/api/submissions` with all data
- Server validates token, checks fraud, creates submission atomically
- Token is hashed (SHA256) and stored to prevent replay attacks

### 3. Static Site Generation

**Why SSG**:
- Fast load times (pre-rendered HTML)
- Excellent SEO
- Low bandwidth usage
- Works with Workers Assets binding
- No server-side rendering needed

**Build Output**:
- `frontend/dist/` contains static HTML, CSS, JS
- Worker serves these files directly
- Hydration for React components (client:load)

### 4. Fraud Detection Strategy

**Ephemeral ID (Preferred)**:
- Enterprise Bot Management feature
- 7-day detection window (IDs rotate after a few days)
- Checks: submission count, validation attempts, unique emails, rapid submissions
- Risk score calculation with 70-point block threshold

**IP-based Fallback**:
- Used when ephemeral ID unavailable
- 1-hour detection window
- Less accurate (VPNs, proxies, shared IPs)
- Lower risk scores to reduce false positives

### 5. Database Schema Design

**Two Main Tables**:

1. **submissions** (42 fields)
   - Form data (first_name, last_name, email, etc.)
   - Geographic metadata (country, region, city, postal_code, lat/long, timezone, continent, is_eu_country)
   - Network metadata (ASN, colo, HTTP protocol, TLS version/cipher)
   - Bot signals (bot_score, client_trust_score, verified_bot, detection_ids)
   - Fingerprints (JA3 hash, JA4, JA4 signals)
   - Tracking (ephemeral_id, remote_ip, user_agent, created_at)

2. **turnstile_validations** (35 fields)
   - Validation result (success, allowed, block_reason, risk_score)
   - Turnstile data (challenge_ts, hostname, action, ephemeral_id)
   - Request metadata (same as submissions)
   - Linking (submission_id foreign key, token_hash for replay protection)

**Indexes**:
- `token_hash` (unique) - Prevents token reuse
- `ephemeral_id` - Fast fraud detection queries
- `created_at` - Time-based analytics
- `email`, `country`, `ja3_hash`, `ja4`, `bot_score` - Analytics performance

### 6. Metadata Extraction

**40+ Fields from request.cf**:
```typescript
export function extractRequestMetadata(request: CloudflareRequest): RequestMetadata {
  const cf = request.cf;

  return {
    // Geographic (9 fields)
    country: cf?.country,
    region: cf?.region,
    city: cf?.city,
    postalCode: cf?.postalCode,
    latitude: cf?.latitude,
    longitude: cf?.longitude,
    timezone: cf?.timezone,
    continent: cf?.continent,
    isEUCountry: cf?.isEUCountry,

    // Network (5 fields)
    asn: cf?.asn,
    asOrganization: cf?.asOrganization,
    colo: cf?.colo,
    httpProtocol: cf?.httpProtocol,
    tlsVersion: cf?.tlsVersion,
    tlsCipher: cf?.tlsCipher,

    // Bot Management (6+ fields - Enterprise only)
    botScore: cf?.botManagement?.score,
    clientTrustScore: cf?.botManagement?.clientTrustScore,
    verifiedBot: cf?.botManagement?.verifiedBot,
    ja3Hash: cf?.botManagement?.ja3Hash,
    ja4: cf?.botManagement?.ja4,
    ja4Signals: cf?.botManagement?.ja4Signals,
    detectionIds: cf?.botManagement?.detectionIds,

    // Request (3 fields)
    remoteIp: headers.get('cf-connecting-ip'),
    userAgent: headers.get('user-agent'),
    timestamp: new Date().toISOString()
  };
}
```

## API Endpoints

### POST /api/submissions
Submit form with Turnstile validation (single-step operation).

**Request**:
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

**Response**:
```json
{
  "success": true,
  "id": 123,
  "message": "Submission created successfully"
}
```

### GET /api/analytics/stats
Get validation statistics.

### GET /api/analytics/submissions
Get recent submissions (supports pagination).

### GET /api/analytics/countries
Get submissions by country.

### GET /api/analytics/bot-scores
Get bot score distribution.

## Deployment

The project uses a unified deployment process:

```bash
# Build frontend + deploy worker
npm run deploy

# Or step-by-step:
npm run build      # Build frontend only
wrangler deploy    # Deploy worker only
```

**Deployment Flow**:
1. `npm run build` executes `cd frontend && npm run build && cd ..`
2. Astro generates static files to `frontend/dist/`
3. `wrangler deploy` bundles Worker code + uploads
4. Worker ASSETS binding serves files from `frontend/dist/`
5. Custom domain routes traffic to Worker

## Environment Setup

**Required Secrets** (via `wrangler secret`):
```bash
wrangler secret put TURNSTILE-SECRET-KEY
wrangler secret put TURNSTILE-SITE-KEY
```

**Configuration** (wrangler.jsonc):
```jsonc
{
  "name": "forminator",
  "main": "src/index.ts",
  "compatibility_date": "2025-11-12",

  "assets": {
    "binding": "ASSETS",
    "directory": "./frontend/dist"
  },

  "d1_databases": [{
    "binding": "DB",
    "database_name": "DB",
    "database_id": "YOUR-DATABASE-ID"
  }],

  "routes": [{
    "pattern": "form.erfi.dev",
    "custom_domain": true
  }]
}
```

## Development

**Local Development with Remote D1**:
```bash
# Terminal 1: Build frontend (watch mode)
cd frontend && npm run dev

# Terminal 2: Run worker with remote D1
cd .. && wrangler dev --remote
```

**Why Remote D1?**
- Consistency with production
- No local/remote data sync issues
- Realistic testing environment
- Easier debugging

## Performance Considerations

- **Static Assets**: Pre-rendered, served from edge
- **D1 Queries**: Indexed for fast lookups
- **Worker Execution**: < 50ms typical response time
- **Turnstile Validation**: Adds ~100-300ms
- **Total Submission Time**: Usually < 500ms

## Scalability

- **Workers**: Auto-scales globally
- **D1**: Eventual consistency, suitable for form submissions
- **Assets**: CDN-cached, instant delivery
- **Rate Limiting**: Basic D1-based (can upgrade to Durable Objects for strict enforcement)

## Security Highlights

1. **Single-Use Tokens**: Prevents replay attacks
2. **Token Hashing**: SHA256, not stored in plaintext
3. **Fraud Detection**: Ephemeral ID + IP-based fallback
4. **Input Validation**: Zod schemas client + server
5. **SQL Injection**: Parameterized queries only
6. **XSS Prevention**: Input sanitization
7. **CORS**: Configured for specific domains
8. **CSP Headers**: Prevents inline script injection
9. **Rate Limiting**: IP-based throttling

## Monitoring

**Key Metrics**:
- Total validations
- Success rate
- Block rate
- Fraud detection triggers
- Average response time
- Submissions per country
- Bot score distribution

**Logs**:
- All validation attempts (success + failure)
- Fraud detection decisions
- Token replay attempts
- Rate limit hits
- Error codes

## Further Reading

- [SECURITY.md](./SECURITY.md) - Security fixes and best practices
- [TURNSTILE.md](./TURNSTILE.md) - Turnstile integration guide
- [FRAUD-DETECTION.md](./FRAUD-DETECTION.md) - Ephemeral ID strategy
- [API.md](./API.md) - Complete API documentation
