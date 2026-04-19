PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT NULL,
    ends_at TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_active_priority
ON announcements (is_active, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS app_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'stable',
    version_name TEXT NOT NULL,
    build_number INTEGER NOT NULL,
    download_url TEXT NOT NULL,
    release_notes TEXT NOT NULL DEFAULT '',
    force_update INTEGER NOT NULL DEFAULT 0,
    min_supported_build INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, channel, build_number)
);

CREATE INDEX IF NOT EXISTS idx_app_versions_check
ON app_versions (platform, status, build_number DESC);

CREATE TABLE IF NOT EXISTS help_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_categories_active_sort
ON help_categories (is_active, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS help_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '',
    view_count INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category_active_sort
ON help_articles (category_id, is_active, sort_order ASC, id DESC);

CREATE INDEX IF NOT EXISTS idx_help_articles_keywords
ON help_articles (title, keywords);

CREATE TABLE IF NOT EXISTS feedback_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    user_id TEXT NULL,
    user_name TEXT NULL,
    contact TEXT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    source_platform TEXT NOT NULL,
    app_version TEXT NULL,
    device_info TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_user
ON feedback_tickets (user_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status
ON feedback_tickets (status, id DESC);
