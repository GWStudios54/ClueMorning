CREATE TABLE IF NOT EXISTS leaderboard (
  date TEXT NOT NULL,
  player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  grid_score INTEGER NOT NULL DEFAULT 0,
  groups_score INTEGER NOT NULL DEFAULT 0,
  trail_score INTEGER NOT NULL DEFAULT 0,
  link_score INTEGER NOT NULL DEFAULT 0,
  steps_score INTEGER NOT NULL DEFAULT 0,
  lineup_score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date, player_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_date_score ON leaderboard(date, score DESC);
