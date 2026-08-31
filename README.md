# Clue Morning v2.6.2 — Eight-Topic Deep Cut

Clue Morning is a six-game daily word and logic site for `cluemorning.com`. Everyone receives the same official daily set on the Pacific-time schedule.

## Daily games

- Letter Grid — 5–10 letters, six guesses.
- Four Groups — four hidden connections among sixteen words.
- Letter Trail — 4×4 adjacent-letter word hunt with drag/tap input.
- Triple Link — one word completes three clues.
- Word Steps — four-letter word ladder with a verified shortest path.
- Deep Cut — eight open-answer trivia prompts, 25 seconds each; less-obvious accepted answers score more.

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

Daily completion and automatic posting now use all six current games. Existing D1 tables keep the old `lineup_score` column for backward compatibility and add `deepcut_score` automatically.

## Content rebuild

On Windows, if PowerShell blocks npm scripts, run:

```powershell
node tools\rebuild_content.mjs
```

This rebuilds the 365-day schedule, Trail solutions, Word Steps, Deep Cut daily sets, and `src/puzzles.js`.

## Deploy

1. Extract the project fully.
2. Run `DEPLOY_WINDOWS.cmd`.
3. The script handles the D1 binding/schema setup, tests, and Worker deployment.

After deployment, `/api/health` should report version `2.6.2`, `wordSteps: 365`, `deepCutPrompts: 107`, and `deepCutDailySets: 365`.
