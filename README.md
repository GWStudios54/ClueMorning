# Clue Morning

Clue Morning is a seven-game daily word, logic, trivia, and push-your-luck site for `cluemorning.com`. Everyone receives the same official daily set on the Pacific-time schedule.

## Daily games

- Letter Grid — 5–10 letters, six guesses.
- Four Groups — four hidden connections among sixteen words.
- Letter Trail — 4×4 adjacent-letter word hunt with drag/tap input.
- Triple Link — one word completes three clues.
- Word Steps — four-letter word ladder with a verified shortest path.
- Deep Cut — eight open-answer trivia prompts, 25 seconds each; less-obvious accepted answers score more.
- Last Call — push-your-luck round: bank early or risk it on six more picks.

## Deep Cut

Deep Cut replaces the retired Lineup game. It uses curated closed-category prompts and generates 365 shared eight-prompt daily sets. Accepted answers are ordered editorially from more obvious to less obvious so scoring works immediately without needing a large player population. Each valid answer scores 30–100 points.

The browser receives only prompt IDs/text. Accepted answer lists stay in the Worker runtime and are checked by `/api/deepcut/check`.

## SEO foundation

- canonical metadata, Open Graph metadata, robots directives and structured data
- `/robots.txt` and `/sitemap.xml`
- `/about/`
- crawlable game guides for all seven games, including `/games/deep-cut/` and `/games/last-call/`
- the retired `/games/lineup/` page redirects visitors to Deep Cut and is `noindex`

## Leaderboard

Daily completion and automatic posting cover all seven current games, plus permanent-record boards for All Seven, Pangram, and Tileworks. Existing D1 tables keep the old `lineup_score` column for backward compatibility and add `deepcut_score` automatically.

## Content rebuild

On Windows, if PowerShell blocks npm scripts, run:

```powershell
node tools\rebuild_content.mjs
```

This rebuilds the 365-day schedule, Trail solutions, Word Steps, Deep Cut daily sets, and `src/puzzles.js`.

## Deploy

Production deploys from the `main` branch through Cloudflare's native Git integration. The configured build step ensures the D1 leaderboard binding exists, applies `schema.sql`, and runs the test suite before `npx wrangler deploy` publishes the Worker.

After deployment, `/api/health` should report the current `package.json` version, `leaderboard: true`, `wordSteps: 365`, and matching `deepCutPrompts`/`deepCutDailySets` counts.
