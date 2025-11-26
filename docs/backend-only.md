# Backend-Only Deployments

Forminator ships with an Astro demo form, but the Cloudflare Worker (fraud detection + analytics APIs) can run completely independently. This guide walks through deploying only the backend and pointing your own frontend at the REST endpoints.

---

## 1. Deploying without static assets

1. **Disable asset serving**
   - Remove the `"assets"` block from your `wrangler` config *or* override it at deploy time.
   - Set `DISABLE_STATIC_ASSETS` to `"true"` via `wrangler deploy --var DISABLE_STATIC_ASSETS=true` or by adding to `vars`:
     ```jsonc
     {
       "vars": {
         "DISABLE_STATIC_ASSETS": "true",
         "ALLOWED_ORIGINS": "https://yourapp.com"
       }
     }
     ```
2. **Keep the API routes**
   - Leave the `ROUTES` map as-is (or customize) so `/api/submissions`, `/api/analytics/*`, `/api/config`, etc. remain reachable.
3. **Bindings & secrets**
   - Required: `DB` (D1), `TURNSTILE-SECRET-KEY`, `TURNSTILE-SITE-KEY`.
   - Optional: `FRAUD_DETECTOR` (Markov-Mail RPC), `FORM_CONFIG` KV.
4. **Deploy**
   ```bash
   wrangler deploy --var DISABLE_STATIC_ASSETS=true
   ```
   Any unmatched route now returns a JSON 404 pointing back to this doc instead of attempting to serve Astro assets.

---

## 2. Integrating your own form

Submitters should POST JSON to the submissions route you configured (default `/api/submissions`):

```ts
async function submitForm(payload) {
  const res = await fetch('https://api.example.com/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      turnstileToken: window.turnstileToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 429) {
      // data.retryAfter (seconds) and data.expiresAt are provided
      throw new Error(data.message);
    }
    throw new Error(data.message || 'Submission failed');
  }

  return data; // Contains erfid, success message, etc.
}
```

**Responses**
- `200 OK`: success payload with `erfid`, optional `message`.
- `400 / 422`: validation errors with `message`.
- `409`: duplicate email (exact message provided).
- `429`: rate-limit with `retryAfter`, `expiresAt`, `erfid`.

Set `ALLOWED_ORIGINS` to include your frontend so CORS succeeds.

### Optional TypeScript helper

The repository ships a lightweight fetch wrapper in [`clients/forminator-client.ts`](../clients/forminator-client.ts). You can copy it into your project or import it directly if this repo is part of your workspace:

```ts
import { submitToForminator } from '../../clients/forminator-client';

await submitToForminator({
  endpoint: 'https://api.example.com/api/submissions',
  payload: {
    ...formValues,
    turnstileToken,
  },
});
```

It normalizes JSON parsing and throws a `ForminatorRequestError` that carries `status`, `retryAfter`, `expiresAt`, and `erfid` for UI messaging.

---

## 3. Analytics / Config APIs

All analytics endpoints remain available; they only require the `X-API-KEY` header. Example:

```bash
curl -H "X-API-KEY: $KEY" https://api.example.com/api/analytics/stats
```

Use these for dashboards or to power your own admin UI.

---

## 4. Optional configuration

- **`FRAUD_CONFIG`** – override risk weights, thresholds, or turn off deterministic blocking (`risk.mode: "additive"`).
- **`FORM_CONFIG` KV** – supply field mappings when your payload differs from the demo schema.
- **`ROUTES`** – rename `/api/…` paths without touching code.

With `DISABLE_STATIC_ASSETS=true`, the Worker behaves as a headless API that any frontend (Next.js, mobile app, etc.) can call, while this repo’s Astro demo continues to showcase the same backend when needed.
