# SpillFlare

A public, open-access, multi-page web product for exploring Nigeria's oil spill and gas flare records. It is built with Next.js App Router, TypeScript, Leaflet and Recharts.

## Run locally

1. Copy `.env.example` to `.env.local` if you want to set the canonical site URL or enable the data assistant with an OpenRouter API key.
2. Run `npm install`.
3. Run `npm run sync:data` to refresh and validate all public source snapshots.
4. Run `npm run dev` and open `http://localhost:3000`.

For a production-like local run, use `npm start`. It starts the site and refreshes the public source snapshots immediately, then once per minute in the background. If one source fails, the last successful snapshot stays available and that source is marked degraded.

## Data assistant

The bottom-right assistant answers only from the public NOSDRA and Nigeria Gas Flare Tracker snapshots. Add `OPENROUTER_API_KEY` from [OpenRouter](https://openrouter.ai/keys) to `.env.local` and restart the app to enable its language model. It uses the free `liquid/lfm-2.5-2.6b:free` OpenRouter model, checks source records through dedicated data tools, keeps missing values as “not supplied,” and does not make predictions or unsupported environmental conclusions.

The checked-in `data/snapshots` directory is a last-known-good fallback. Live retrieval and observation recency are shown separately throughout the interface.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Public data routes

- `/api/spills`
- `/api/spills/[id]`
- `/api/flares?area=state&period=2026-05`
- `/api/geo?layer=states`
- `/api/search?q=Bayelsa`
- `/api/export?dataset=spills&year=2026`
- `/api/source-health`

## Data rules

- Nigeria only; valid offshore records remain visible.
- The primary and mirror spill endpoints are the same dataset and are not double-counted.
- Missing or invalid values are never assumed to be zero.
- State, LGA, cluster, oil block and onshore/offshore aggregations remain distinct.
- Company flare analytics are historical and stop at October 2020.
- Population values, where used, retain the source label “estimated population living within 2 km of flare locations.”
