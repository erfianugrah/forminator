# Cloudflare Turnstile Demo

A full-stack Turnstile demo application built with Astro, shadcn/ui, Cloudflare Workers, D1, and Pino.js. Features comprehensive fraud detection using Cloudflare's Bot Management signals, JA3/JA4 fingerprinting, and ephemeral IDs.

## Features

- **Turnstile Integration**: Explicit rendering with interaction-only appearance
- **Rich Request Metadata**: Captures IP, geolocation, ASN, bot scores, JA3/JA4 fingerprints, detection IDs, and more
- **Fraud Detection**: Multi-layered fraud prevention using ephemeral IDs and IP-based checks
- **Form Validation**: Client and server-side validation with Zod
- **Analytics Dashboard**: Real-time visualization of submissions and validation statistics
- **Dark Mode**: Full dark mode support with shadcn/ui components
- **Security Hardened**: Token replay protection, SQL injection prevention, rate limiting

## Quick Start

```bash
# Install dependencies
npm install

# Create .dev.vars for local secrets
cat > .dev.vars << EOF
TURNSTILE-SECRET-KEY=your_secret_key
TURNSTILE-SITE-KEY=0x4AAAAAACAjw0bmUZ7V7fh2
EOF

# Initialize local D1 database
wrangler d1 execute turnstile-demo --local --file=../schema.sql

# Start development server
npm run dev
```

Visit `http://localhost:4321` to see the form.

## Setup Instructions

### 1. D1 Database Setup

If you haven't created the D1 database yet:

```bash
# Create database
wrangler d1 create turnstile-demo

# Update wrangler.jsonc with the database_id from the output

# Initialize schema (local)
wrangler d1 execute turnstile-demo --local --file=../schema.sql

# Initialize schema (production)
wrangler d1 execute turnstile-demo --file=../schema.sql
```

### 2. Configure Secrets

```bash
# Local development: create .dev.vars
cat > .dev.vars << EOF
TURNSTILE-SECRET-KEY=your_secret_key_here
TURNSTILE-SITE-KEY=0x4AAAAAACAjw0bmUZ7V7fh2
EOF

# Production: use wrangler
wrangler secret put TURNSTILE-SECRET-KEY
wrangler secret put TURNSTILE-SITE-KEY
```

## Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start local dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run deploy` | Deploy to Cloudflare |

## API Endpoints

- `POST /api/submissions` - Submit form with Turnstile validation
- `GET /api/analytics/stats` - Get validation statistics
- `GET /api/analytics/submissions` - Get recent submissions
- `GET /api/analytics/countries` - Get submissions by country
- `GET /api/analytics/bot-scores` - Get bot score distribution

## Security Features

1. **Token Replay Protection**: SHA256 hash tracking
2. **Fraud Detection**: Ephemeral ID + IP-based checks
3. **SQL Injection Prevention**: Parameterized queries
4. **Input Sanitization**: HTML stripping and normalization
5. **Rate Limiting**: Built-in fraud detection thresholds

## Documentation

See parent directory for detailed documentation:
- `PLAN.md` - Implementation plan
- `TURNSTILE-IMPLEMENTATION.md` - Turnstile strategy
- `SECURITY-FIXES.md` - Security details
- `EPHEMERAL-ID-STRATEGY.md` - Fraud detection approach

## Troubleshooting

**D1 not found**: Run `wrangler d1 list` and verify database_id in wrangler.jsonc

**Turnstile not loading**: Check browser console and verify sitekey in TurnstileWidget.tsx

**Bot scores null**: Requires Cloudflare Enterprise with Bot Management enabled
