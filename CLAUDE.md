# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **NeevCloud GTM Engineer Case Study** submission — a live content intelligence platform demonstrating an 80-posts/week SEO engine for NeevCloud (AI-first sovereign cloud/GPU compute, India). Deliverables: `NeevCloud_Technical_Plan.docx`, `NeevCloud_Defense_Deck.pptx`, and this working prototype hosted at `gtm.prasadkhake.com`.

The brief is in `GTM Task.pdf`. The core argument: publishing 80/week is trivial; surviving it (site-level quality demotion, crawl budget starvation, partial indexation) is the hard part. The answer is a hybrid content shape — programmatic substrate for volume + editorial spine for E-E-A-T.

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build (type-checks too)
npm run lint         # eslint

# Re-run the site audit against www.neevcloud.com
node scripts/run-audit.mjs
# Output → data/audit.json (auto-picked up by /audit page on next build/restart)

# Deploy
vercel --prod        # from repo root; configure gtm.prasadkhake.com as custom domain
```

## AGENTS.md / Next.js version

**This is Next.js 16.2.7** — read `node_modules/next/dist/docs/` before writing any Next.js code. APIs and conventions differ from training data. The `AGENTS.md` at root repeats this warning.

## Architecture

**No database. No separate backend.** Everything is:
- Static pages (pre-fetched JSON bundled at build time)
- Next.js API routes (server-side, protect API keys, called from client components)
- A standalone Node.js audit script (`scripts/run-audit.mjs`)

### Pages and what runs where

| Route | Type | What it does |
|-------|------|-------------|
| `/` | Static (SSG) | Architecture overview, volume trap explainer |
| `/audit` | Static (SSG) | Loads `data/audit.json` at build time — server component, no client JS |
| `/pipeline` | Client component | Keyword clusters + brief generation + live clustering |
| `/qa` | Client component | URL fetch + content QA scoring |

### API routes (all `POST`, all server-side)

| Route | Model | Purpose |
|-------|-------|---------|
| `/api/brief` | `claude-sonnet-4-6` | Streaming brief generation — high quality needed |
| `/api/qa` | `claude-haiku-4-5-20251001` | 5-dim QA scoring via `tool_use` — fast + cheap |
| `/api/cluster` | `claude-haiku-4-5-20251001` | Keyword clustering; uses OpenAI embeddings first if ≥6 keywords |
| `/api/keywords` | DataForSEO + Google Autocomplete | Volume/CPC/intent enrichment; falls back to free Autocomplete if no creds |
| `/api/fetch-url` | native fetch | Fetches a URL server-side, strips HTML, returns readable text for QA |

All Anthropic clients are instantiated **inside** the handler (not at module level) — required to avoid build-time errors when `ANTHROPIC_API_KEY` is absent.

All system messages use `cache_control: { type: "ephemeral" }` for prompt caching.

### Data layer

Three static JSON files bundled at build time:

- `data/audit.json` — output of `scripts/run-audit.mjs`. 132 pages crawled from `www.neevcloud.com` (sitemap-first → BFS). `blog.neevcloud.com` is excluded: Hashnode serves it behind a Vercel security checkpoint (HTTP 429 for all bot UAs; Hashnode's public GraphQL API was deprecated in 2025). The `blogNote` field in the JSON explains this inline.
- `data/keywords/clusters.json` — 5 pre-fetched topic clusters with DataForSEO keyword metrics. Shown on `/pipeline` instantly; live clustering via `/api/cluster` is the "try it" path.
- `data/briefs/index.json` — pre-generated briefs for `sovereign-cloud` and `gpu-compute` clusters. Loaded instantly on the Brief tab; "Run live →" calls the streaming API.

### The two-mode pattern

Every interactive section has the same shape: **pre-fetched data loads instantly → "Run live" button calls real APIs**. This lets graders see impressive results immediately while proving the pipeline is real. Keep this pattern when adding features.

### Components

- `components/NavLinks.tsx` — `"use client"`, uses `usePathname()` for active state. Extract from layout because layout is a server component.
- `components/LoadingMessage.tsx` — `useLoadingMessages(messages, active)` hook + `<LoadingDots>` component. Used in pipeline and QA pages for rotating progress text during API calls.

## Design system

Dark monospace palette defined as CSS variables in `app/globals.css`. Use these everywhere — no hardcoded hex except `#0e0e10` for green-on-dark text.

```
--background:    #0e0e10   (page bg)
--panel:         #16161a   (card bg)
--border:        #26262c
--foreground:    #ededec
--muted-foreground: #8a8a93
--accent-green:  #5ad19b   (CTAs, positive states)
--accent-amber:  #e0a24a   (warnings, T2 clusters)
--accent-red:    #e0685a   (errors, critical findings)
```

All page content is constrained to `max-w-5xl mx-auto px-6`. Header and footer use the same constraint — never let content go edge-to-edge.

## Environment variables

```
ANTHROPIC_API_KEY      claude-sonnet-4-6 (briefs) + claude-haiku-4-5-20251001 (QA, clustering)
OPENAI_API_KEY         text-embedding-3-small for semantic pre-clustering
DATAFORSEO_LOGIN       pk@career-9.com
DATAFORSEO_PASSWORD    (see .env.local)
```

Copy `.env.example` → `.env.local`. DataForSEO is pay-per-use (~$0.0006/keyword); the $1 welcome credit covers demo usage. The `/api/keywords` route degrades gracefully to Google Autocomplete (free, no key) if DataForSEO creds are absent or exhausted.

## Keyword type normalisation

Keywords arrive as either `string` (from live Claude clustering) or `{ keyword, volume, cpc, intent }` objects (from pre-fetched JSON and DataForSEO). The `normalizeKws()` helper in `app/pipeline/page.tsx` handles both. Always use it before rendering keyword chips or tables.

## Audit script

`scripts/run-audit.mjs` is a self-contained ESM script using Node's native `fetch` + `cheerio`. It:
1. Reads `robots.txt` → sitemap(s) → discovers all URLs
2. BFS-crawls from sitemap seeds (cap 500, 400ms delay — polite)
3. Runs TF-IDF cosine analysis for cannibalization (threshold 0.78), orphan detection, and link recommendations
4. Writes `data/audit.json`

Run it, then rebuild (`npm run build`) for the `/audit` page to pick up new data.

## Git

Always push as `robertlangdonn`:
```bash
gh auth switch --user robertlangdonn
git push
```
Remote: `https://github.com/robertlangdonn/neev-cloud-gtm`
