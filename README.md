# Clue Morning v2.6.3 — Interaction Polish

Clue Morning is a six-game daily word and logic site for `cluemorning.com`. Everyone receives the same official daily set on the Pacific-time schedule.

## Daily games

- Letter Grid — 5–10 letters, six guesses.
- Four Groups — four hidden connections among sixteen words.
- Letter Trail — 4×4 adjacent-letter word hunt with drag/tap input.
- Triple Link — one word completes three clues.
- Word Steps — four-letter word ladder with a verified shortest path.
- Deep Cut — eight open-answer trivia prompts, 25 seconds each; less-obvious accepted answers score more.

## v2.6.3 interaction polish

- Letter Trail drag selection is smoother and directional so a finger moving toward a diagonal/adjacent letter is less likely to snap onto a side tile. Dragging back over the prior tile also backs up one letter.
- Four Groups solved categories now show color-coded difficulty levels (Easy, Medium, Hard, Tricky), and the overall set difficulty is shown after completion.
- Letter Grid now writes the current typed guess directly into the active row so the player can see exactly how many letters are filled before submitting.

## Deep Cut

Deep Cut replaces Lineup in the six-game daily set. It uses 107 curated closed-category prompts and generates 365 shared eight-prompt daily sets. Accepted answers are ordered editorially from more obvious to less obvious so scoring works immediately without needing a large player population. Each valid answer scores 30–100 points.

The browser receives only prompt IDs/text. Accepted answer lists stay in the Worker runtime and are checked by `/api/deepcut/check`.

## SEO foundation

- canonical metadata, Open Graph metadata, robots directives and structured data
- `/robots.txt` and `/sitemap.xml`
- `/about/`
- crawlable game guides for all six games, including `/games/deep-cut/`
- the retired `/games/lineup/` page redirects visitors to Deep Cut and is `noindex`

## Leaderboard

Daily completion and automatic posting use all six current games. Existing D1 tables keep the old `lineup_score` column for backward compatibility and add `deepcut_score` automatically.

## Content rebuild

On Windows, if PowerShell blocks npm scripts, run:

```powershell
node tools\rebuild_content.mjs
```

This rebuilds the 365-day schedule, Trail solutions, Word Steps, Deep Cut daily sets, and `src/puzzles.js`.

## Deploy

Production deploys from the `main` branch through Cloudflare's native Git integration. The configured build step ensures the D1 leaderboard binding exists, applies `schema.sql`, and runs the test suite before `npx wrangler deploy` publishes the Worker.

After deployment, `/api/health` should report version `2.6.3`, `leaderboard: true`, `wordSteps: 365`, `deepCutPrompts: 107`, and `deepCutDailySets: 365`.
