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
  deepcut_score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date, player_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_date_score ON leaderboard(date, score DESC);

CREATE TABLE IF NOT EXISTS leaderboard_game_scores (
  date TEXT NOT NULL,
  game TEXT NOT NULL,
  player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date, game, player_id)
);
CREATE INDEX IF NOT EXISTS idx_lb_game_date_score ON leaderboard_game_scores(date, game, score DESC);
CREATE INDEX IF NOT EXISTS idx_lb_game_player ON leaderboard_game_scores(player_id);

CREATE TABLE IF NOT EXISTS leaderboard_records (
  game TEXT NOT NULL,
  player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (game, player_id)
);
CREATE INDEX IF NOT EXISTS idx_lb_records_score ON leaderboard_records(game, score DESC);

CREATE TABLE IF NOT EXISTS push_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  device_token TEXT PRIMARY KEY,
  player_id TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  morning_enabled INTEGER NOT NULL DEFAULT 1,
  morning_time TEXT NOT NULL DEFAULT '07:00',
  streak_enabled INTEGER NOT NULL DEFAULT 0,
  streak_time TEXT NOT NULL DEFAULT '19:00',
  last_open_date TEXT,
  progress_date TEXT,
  completed_count INTEGER NOT NULL DEFAULT 0,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_morning_date TEXT,
  last_streak_date TEXT,
  last_test_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_active ON push_subscriptions(morning_enabled, streak_enabled);
