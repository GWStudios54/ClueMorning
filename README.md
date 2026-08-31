# Clue Morning v2.6.0 — Six Games + SEO Foundation

This release expands the daily set from four games to six and adds a real search-engine foundation for `cluemorning.com`.

## New daily games

### Word Steps
- Four-letter word ladder.
- Change exactly one letter per move.
- Every intermediate word must be in the Clue Morning dictionary.
- Daily puzzles include a known shortest path and a par value.
- Up to eight moves; players can undo or reveal a shortest path.
- 365 generated daily Word Steps puzzles are included.

### Lineup
- Six items must be placed in the correct order.
- Daily rules vary: chronology, size, distance, rank, sequence, and more.
- Three checks are allowed; the solution is revealed after the third miss.
- 365 generated daily Lineup puzzles are included from curated ordered fact sets.

## Six-game daily system
- Today now contains Letter Grid, Four Groups, Letter Trail, Triple Link, Word Steps, and Lineup.
- Daily score, streak completion, archive completion, and automatic leaderboard posting now use all six games.
- The D1 leaderboard automatically adds `steps_score` and `lineup_score` columns to an existing database on first use.
- Existing four-game local state is preserved; the two new games are added cleanly to the current day.

## SEO foundation
- Homepage title and description rewritten around free daily word and logic games.
- Canonical URL, robots meta, Open Graph metadata, Twitter metadata, and WebSite structured data added.
- Added `/robots.txt` and `/sitemap.xml`.
- Added crawlable, indexable game guide pages:
  - `/games/letter-grid/`
  - `/games/four-groups/`
  - `/games/letter-trail/`
  - `/games/triple-link/`
  - `/games/word-steps/`
  - `/games/lineup/`
- Added `/about/`.
- Homepage contains crawlable internal links to all six game guides.
- Game-guide play buttons deep-link back into the correct daily game with `/?play=...`.

## Deploy
1. Extract the ZIP completely.
2. Run `DEPLOY_WINDOWS.cmd`.
3. The deploy script will find/create the D1 database, bind it, apply schema setup, test, and deploy.

Do not run the deployment script from inside the ZIP.

## Optional content rebuild
On Windows, run this directly if PowerShell blocks npm scripts:

```powershell
node tools\rebuild_content.mjs
```

It rebuilds the 365-day content pack, Trail solutions, Word Steps puzzles, and Lineup puzzles.

## Health endpoint
After deployment, `/api/health` should report version `2.6.0`, `leaderboard: true`, `wordSteps: 365`, and `lineups: 365`.
