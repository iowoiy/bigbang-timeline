-- BIGBANG Timeline D1 Database Schema
-- 時間軸 + 社群備份資料表

-- =====================================================
-- 時間軸事件
-- =====================================================
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  categories TEXT DEFAULT '[]',    -- JSON array: ["music", "milestone"]
  members TEXT DEFAULT '[]',       -- JSON array: ["G-Dragon", "T.O.P"]
  links TEXT DEFAULT '[]',         -- JSON array: [{url, label, author, ts}]
  notes TEXT DEFAULT '[]',         -- JSON array: [{text, author, ts}]
  media TEXT DEFAULT '[]',         -- JSON array: [{url, backupUrl, author, ts}]
  edit_log TEXT DEFAULT '[]',      -- JSON array: [{author, action, ts}]
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- 社群備份
-- =====================================================
CREATE TABLE IF NOT EXISTS social_archives (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('post', 'story', 'reels')),
  member TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  ig_url TEXT,
  caption TEXT,
  media TEXT DEFAULT '[]',         -- JSON array: [{url, type, backupUrl, thumbnail, thumbnailBackupUrl}]
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- b.stage 會員限定備份
-- =====================================================
CREATE TABLE IF NOT EXISTS bstage_archives (
  id TEXT PRIMARY KEY,
  member TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  caption TEXT,
  media TEXT DEFAULT '[]',
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  source_url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- 會員備份（b.stage 會員限定內容，無 likes/comments）
-- =====================================================
CREATE TABLE IF NOT EXISTS membership_archives (
  id TEXT PRIMARY KEY,
  member TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  caption TEXT,
  media TEXT DEFAULT '[]',         -- JSON array: [{url, type, backupUrl, thumbnail}]
  source_url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- =====================================================
-- 訪客記錄
-- =====================================================
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  country TEXT,
  user_agent TEXT,
  device TEXT,
  browser TEXT,
  referrer TEXT,
  author_id TEXT,                  -- 選擇的身份 (可為 null)
  timestamp INTEGER NOT NULL
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_year_month ON events(year, month);
CREATE INDEX IF NOT EXISTS idx_social_member ON social_archives(member);
CREATE INDEX IF NOT EXISTS idx_social_date ON social_archives(date);
CREATE INDEX IF NOT EXISTS idx_social_type ON social_archives(type);
CREATE INDEX IF NOT EXISTS idx_social_updated ON social_archives(updated_at);
CREATE INDEX IF NOT EXISTS idx_bstage_member ON bstage_archives(member);
CREATE INDEX IF NOT EXISTS idx_bstage_date ON bstage_archives(date);
CREATE INDEX IF NOT EXISTS idx_bstage_updated ON bstage_archives(updated_at);
CREATE INDEX IF NOT EXISTS idx_membership_member ON membership_archives(member);
CREATE INDEX IF NOT EXISTS idx_membership_date ON membership_archives(date);
CREATE INDEX IF NOT EXISTS idx_membership_updated ON membership_archives(updated_at);
CREATE INDEX IF NOT EXISTS idx_visitors_timestamp ON visitors(timestamp);
CREATE INDEX IF NOT EXISTS idx_visitors_ip ON visitors(ip);
