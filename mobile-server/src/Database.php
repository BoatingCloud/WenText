<?php

declare(strict_types=1);

namespace MobileServer;

use PDO;

final class Database
{
    private PDO $pdo;

    public function __construct(string $sqlitePath)
    {
        $this->ensureDirectory(dirname($sqlitePath));

        $isNewDatabase = !file_exists($sqlitePath);

        $this->pdo = new PDO('sqlite:' . $sqlitePath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec('PRAGMA foreign_keys = ON');

        if ($isNewDatabase) {
            $this->initializeDatabase();
        }
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    private function ensureDirectory(string $directory): void
    {
        if (is_dir($directory)) {
            return;
        }

        mkdir($directory, 0775, true);
    }

    private function initializeDatabase(): void
    {
        $sql = <<<'SQL'
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
SQL;

        $this->pdo->exec($sql);
        $this->seedInitialData();
    }

    private function seedInitialData(): void
    {
        $now = gmdate('Y-m-d H:i:s');

        $this->pdo->exec("
            INSERT INTO announcements (title, content, is_active, priority, created_at, updated_at)
            VALUES
                ('欢迎使用', '感谢使用本服务！', 1, 100, '{$now}', '{$now}'),
                ('系统维护通知', '系统将于本周末进行例行维护', 1, 50, '{$now}', '{$now}')
        ");

        $this->pdo->exec("
            INSERT INTO app_versions (platform, version_name, build_number, download_url, release_notes, status, created_at, updated_at)
            VALUES
                ('android', '1.0.0', 100, 'https://example.com/app-v1.0.0.apk', '首个正式版本', 'PUBLISHED', '{$now}', '{$now}'),
                ('ios', '1.0.0', 100, 'https://apps.apple.com/app/id123456', '首个正式版本', 'PUBLISHED', '{$now}', '{$now}')
        ");

        $this->pdo->exec("
            INSERT INTO help_categories (name, sort_order, created_at, updated_at)
            VALUES
                ('常见问题', 1, '{$now}', '{$now}'),
                ('使用指南', 2, '{$now}', '{$now}'),
                ('账号相关', 3, '{$now}', '{$now}')
        ");

        $this->pdo->exec("
            INSERT INTO help_articles (category_id, title, content_md, keywords, sort_order, created_at, updated_at)
            VALUES
                (1, '如何注册账号？', '# 注册步骤\n\n1. 打开应用\n2. 点击注册按钮\n3. 填写信息\n4. 完成注册', '注册,账号', 1, '{$now}', '{$now}'),
                (1, '忘记密码怎么办？', '# 找回密码\n\n1. 点击忘记密码\n2. 输入邮箱\n3. 查收重置邮件', '密码,找回', 2, '{$now}', '{$now}'),
                (2, '如何上传文件？', '# 上传文件\n\n1. 点击上传按钮\n2. 选择文件\n3. 等待上传完成', '上传,文件', 1, '{$now}', '{$now}')
        ");
    }
}
