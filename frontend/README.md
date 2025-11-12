# Frontend - Cloudflare Turnstile Demo

Astro static site with React components (shadcn/ui) for the Turnstile demo application.

## Tech Stack

- **Astro**: Static site generator
- **React**: Component library (islands)
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI components
- **Cloudflare Turnstile**: Bot protection widget

## Project Structure

```
frontend/
├── src/
│   ├── components/        # React components
│   │   ├── TurnstileWidget.tsx    # Turnstile integration
│   │   ├── SubmissionForm.tsx     # Main form
│   │   └── AnalyticsDashboard.tsx # Analytics UI
│   ├── layouts/           # Astro layouts
│   │   └── Layout.astro   # Base layout with dark mode
│   ├── pages/             # Static pages
│   │   └── index.astro    # Landing page
│   └── styles/            # Global CSS
└── public/                # Static assets
    └── favicon.svg        # Security-themed favicon
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Components

### TurnstileWidget
Handles Cloudflare Turnstile integration with:
- Explicit rendering
- Execution mode: `execute` (manual trigger)
- Appearance: `interaction-only` (hidden until needed)
- All callbacks implemented (success, error, expired, timeout, unsupported)
- Dark mode sync with system preferences

### SubmissionForm
Contact form with:
- Client-side validation
- Turnstile integration
- Automatic token submission
- Error handling and user feedback

### AnalyticsDashboard
Visualizes:
- Validation statistics
- Recent submissions
- Geographic distribution
- Bot score analytics

## Configuration

### Turnstile Sitekey
Located in `src/components/TurnstileWidget.tsx`:
```typescript
const TURNSTILE_SITEKEY = '0x4AAAAAACAjw0bmUZ7V7fh2';
```

Update this with your actual sitekey for production.

## Build Process

The frontend is built and deployed as part of the main Worker deployment:

1. `npm run build` generates static files to `dist/`
2. Worker serves static files via ASSETS binding
3. API routes handled by Worker backend

## Notes

- This is a **static site only** - no API routes in Astro
- All backend logic handled by Cloudflare Worker (../src/)
- Built files served by Worker's ASSETS binding
- Dark mode persists via localStorage

## Documentation

For complete documentation, see the parent directory:
- [Root README](../README.md) - Complete project documentation
- [GAPS.md](../GAPS.md) - Implementation status
- [docs/](../docs/) - Technical documentation
