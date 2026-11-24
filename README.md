# Roulette: European single zero

A calm, minimalist roulette table. The round engine is decoupled from rendering. The wheel and
ball move in opposite directions and always settle on the server's number. The betting grid shows
what every spot covers before you place a chip. A provider inspector lets you steer latency,
failures and outcomes.

Designed and built by **Oleg Bobokhidze**.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:5177  (press ` for the inspector)
```

Other commands:

```bash
pnpm verify       # typecheck, lint, unit tests, production build
pnpm e2e          # with `pnpm dev` running: 44 browser checks and 5 responsive layouts
pnpm build && pnpm preview
```

Demo links (reproducible sessions):

- `/?inspector=1`: open with the provider inspector.
- `/?force=17&latency=600-1200`: every spin lands on 17, with slow responses.
- `/?seed=demo&landing=2500`: a different server seed and a shorter landing.

## What's inside

| Folder | Contents |
|---|---|
| `src/config` | European wheel order and colours, bet kinds with payouts and limits, chips, timings, palette, sound recipes |
| `src/engine` | 157 bet spots, payout maths, bet slip (undo / rebet / double), round state machine, angle ↔ pocket resolver, seeded RNG, provider contract, mock server, controller |
| `src/renderer` | Dual-motion kinematics (free run, then a planned landing), cached high-DPI Canvas 2D art, rAF loop with frame stats |
| `src/audio` | Subtle Web Audio synthesis (chip, roll, fret ticks, seat, win) with persisted mute |
| `src/ui` | React layout, betting table with coverage preview, chip and action dock, history strip, rules sheet, inspector |

Things worth noticing:

- **The ball always lands on the server's number** and still looks physical. The ball launches the
  moment you press Spin, which hides the network round trip. When the outcome arrives, the rest of
  the motion is planned from the current state using a Hermite curve in the wheel's frame
  ([ADR-0002](docs/decisions/ADR-0002-decoupled-engine-and-dual-motion-physics.md)).
- **One payout rule:** `36 / coverage − 1`, enforced by a test, so the preview, settlement, server and
  rules sheet cannot drift apart ([ADR-0003](docs/decisions/ADR-0003-betting-grid-and-payout-model.md)).
- **Safe retries:** a timeout after the server commits is retry-only, and the retry replays the
  committed round by its id instead of charging twice ([ADR-0004](docs/decisions/ADR-0004-provider-adapter-and-error-recovery.md)).
- The balance only changes once the ball has settled. All figures use tabular numerals, line heights
  are even pixel values (checked by the e2e suite), and primary actions sit on the right.

Keyboard: `Space` spins (or spins again), `Ctrl/⌘+Z` undoes, `1`–`5` choose a chip, `` ` `` toggles
the inspector, and `Esc` closes sheets. Right-click a stack to remove it.

## Sharing and SEO

Links to the deployed game unfurl as a large preview card on WhatsApp, Telegram, Facebook, LinkedIn,
Slack, Discord and X.

- `public/og-image.jpg`: the 1200×630 share card (a live screenshot plus themed copy).
- `share-meta.ts`: a Vite plugin. It reads the title and description from `index.html` and injects
  Open Graph, Twitter/X, canonical and JSON-LD (`VideoGame`) tags. It also writes `robots.txt` and
  `sitemap.xml`.
- Previews need absolute image URLs, so build with the public address:
  `SITE_URL=https://your-domain/ pnpm build`. Netlify (`URL`) and Vercel (`VERCEL_PROJECT_PRODUCTION_URL`)
  provide it automatically.
- After visible UI changes, regenerate the card and icons with `pnpm dev`, then `pnpm share:assets`.
  Copy, palette and crop live in `scripts/share-card.json`.
- Check a deployed link with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  or [opengraph.xyz](https://www.opengraph.xyz/).

## Engineering records

- [AGENTS.md](AGENTS.md): conventions, folder boundaries and the session workflow
- [docs/decisions/](docs/decisions/): ADRs
- [docs/ai/decision-log.jsonl](docs/ai/decision-log.jsonl): timestamped decision log (`pnpm log:decision`)
- [docs/ai/reports/](docs/ai/reports/): session reports (`pnpm report:new -- <slug>`)
