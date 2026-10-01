# Kontrola firmy – Slovak company risk check by IČO

[![CI](https://github.com/sky1407/kontrola-firmy/actions/workflows/ci.yml/badge.svg)](https://github.com/sky1407/kontrola-firmy/actions/workflows/ci.yml)

**Live demo: [kontrola-firmy.vercel.app](https://kontrola-firmy.vercel.app)** – try [a small company with a 5-year trend](https://kontrola-firmy.vercel.app/firma/53445911).

Before you sign a contract or send an invoice, enter the company's IČO (company ID) and get:

- **5-year financial trend**: revenue, net profit/loss, equity, liabilities and total assets, parsed from official financial statements,
- **a transparent risk score**: every point deducted is explained (negative equity, losses 3 years in a row, missing financial statement, …),
- links to the original PDF statements where structured data isn't available (IFRS companies, non-profits).

Data comes from the public API of the Slovak [Register of Financial Statements (RÚZ)](https://www.registeruz.sk/cruz-public/home/api).

## Architecture

```
Browser ──► Next.js (App Router, server components)
              │
              ├─ /firma?ico=…         validates & normalizes IČO → redirect to canonical URL
              └─ /firma/[ico]         streams a skeleton, then the report
                    │
                    ▼
              getCompanyReport()  ── fresh cache? ──► Postgres (company_snapshots, JSONB)
                    │ no / expired
                    ▼
              getCompanyProfile() ──► RÚZ API (≤3 concurrent requests, timeout + 1 retry,
                                       every response validated with Zod)
```

Key decisions:

| Problem | Solution |
| --- | --- |
| RÚZ needs 3–4 chained requests per year of data (entity → statements → reports) | Profile cached in Postgres for 24 h; repeat lookups take ~10 ms instead of 1–3 s |
| The public registry is sometimes slow or down | Timeout + retry on 429/5xx; if it fails, an expired snapshot is served and marked as stale |
| Partial failures (one statement out of five times out) | The profile is kept but flagged `incomplete` and cached for only 1 h |
| Statements are flat arrays of strings tied to form templates | Explicit row mappings per template (`687` micro, `699` small/large) verified by tests against real registry data |
| The registry returns deleted duplicates and records with other IDs | Deleted records are filtered out, the IČO is matched exactly and the most recently updated record wins |
| A database outage | Read/write errors are logged and the request goes straight to the registry |
| Cache schema evolves | Snapshots are versioned; old versions are treated as a cache miss |

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Prisma 7 + PostgreSQL (Neon) · Zod · Recharts · Tailwind CSS 4 · Vitest · GitHub Actions · Vercel (fra1)

Deployment: every push to `main` deploys to Vercel; production builds run `prisma migrate deploy` over the unpooled connection and abort if a migration fails.

## Running locally

```bash
cp .env.example .env
docker compose up -d          # Postgres on port 5433
npm install                   # also generates the Prisma client
npx prisma migrate dev
npm run dev                   # http://localhost:3000
```

```bash
npm test          # unit tests (no network, no DB)
npm run typecheck
npm run lint
```

## Roadmap

- [x] Search by IČO, financial trend, risk score, Postgres cache
- [ ] Daily import of public debtor lists (Social Insurance Agency, health insurers, Financial Administration) via cron
- [ ] Watchlist with e-mail alerts when a company's risk changes

## Disclaimer

This is an informational tool based on public data. It is not legal or financial advice.
