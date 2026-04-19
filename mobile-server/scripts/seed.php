<?php

declare(strict_types=1);

use MobileServer\Config;
use MobileServer\Database;

spl_autoload_register(static function (string $class): void {
    $prefix = 'MobileServer\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', '/', $relativeClass);
    $file = dirname(__DIR__) . '/src/' . $relativePath . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});

$database = new Database(Config::sqlitePath());
$pdo = $database->pdo();

$pdo->beginTransaction();

try {
    $now = gmdate('Y-m-d H:i:s');

    $annCount = (int) $pdo->query('SELECT COUNT(1) AS total FROM announcements')->fetch()['total'];
    if ($annCount === 0) {
        $statement = $pdo->prepare(
            'INSERT INTO announcements (title, content, is_active, priority, starts_at, ends_at, created_at, updated_at)
             VALUES (:title, :content, :isActive, :priority, :startsAt, :endsAt, :createdAt, :updatedAt)'
        );

        $statement->execute([
            ':title' => '欢迎使用文雨移动端',
            ':content' => '移动端已支持公告、版本更新、帮助中心和反馈工单能力。',
            ':isActive' => 1,
            ':priority' => 100,
            ':startsAt' => null,
            ':endsAt' => null,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);

        $statement->execute([
            ':title' => '维护通知',
            ':content' => '每周日 02:00-03:00 进行例行维护，期间部分接口可能抖动。',
            ':isActive' => 1,
            ':priority' => 50,
            ':startsAt' => null,
            ':endsAt' => null,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);
    }

    $versionCount = (int) $pdo->query('SELECT COUNT(1) AS total FROM app_versions')->fetch()['total'];
    if ($versionCount === 0) {
        $statement = $pdo->prepare(
            'INSERT INTO app_versions (
                platform,
                channel,
                version_name,
                build_number,
                download_url,
                release_notes,
                force_update,
                min_supported_build,
                status,
                created_at,
                updated_at
            ) VALUES (
                :platform,
                :channel,
                :versionName,
                :buildNumber,
                :downloadUrl,
                :releaseNotes,
                :forceUpdate,
                :minSupportedBuild,
                :status,
                :createdAt,
                :updatedAt
            )'
        );

        $statement->execute([
            ':platform' => 'android',
            ':channel' => 'stable',
            ':versionName' => '1.0.0',
            ':buildNumber' => 100,
            ':downloadUrl' => 'https://download.wenyu.com/mobile/android/wenyu-1.0.0.apk',
            ':releaseNotes' => "1. 首版发布\n2. 支持帮助中心与反馈工单",
            ':forceUpdate' => 0,
            ':minSupportedBuild' => 90,
            ':status' => 'PUBLISHED',
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);

        $statement->execute([
            ':platform' => 'ios',
            ':channel' => 'stable',
            ':versionName' => '1.0.0',
            ':buildNumber' => 100,
            ':downloadUrl' => 'https://apps.apple.com/app/id0000000000',
            ':releaseNotes' => "1. 首版发布\n2. 支持帮助中心与反馈工单",
            ':forceUpdate' => 0,
            ':minSupportedBuild' => 90,
            ':status' => 'PUBLISHED',
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);
    }

    $categoryCount = (int) $pdo->query('SELECT COUNT(1) AS total FROM help_categories')->fetch()['total'];
    if ($categoryCount === 0) {
        $statement = $pdo->prepare(
            'INSERT INTO help_categories (name, sort_order, is_active, created_at, updated_at)
             VALUES (:name, :sortOrder, :isActive, :createdAt, :updatedAt)'
        );

        $statement->execute([
            ':name' => '快速上手',
            ':sortOrder' => 10,
            ':isActive' => 1,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);

        $statement->execute([
            ':name' => '常见问题',
            ':sortOrder' => 20,
            ':isActive' => 1,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);
    }

    $articleCount = (int) $pdo->query('SELECT COUNT(1) AS total FROM help_articles')->fetch()['total'];
    if ($articleCount === 0) {
        $categories = $pdo->query('SELECT id, name FROM help_categories')->fetchAll();
        $categoryIdByName = [];
        foreach ($categories as $category) {
            $categoryIdByName[$category['name']] = (int) $category['id'];
        }

        $statement = $pdo->prepare(
            'INSERT INTO help_articles (
                category_id,
                title,
                content_md,
                keywords,
                view_count,
                is_active,
                sort_order,
                created_at,
                updated_at
            ) VALUES (
                :categoryId,
                :title,
                :contentMd,
                :keywords,
                :viewCount,
                :isActive,
                :sortOrder,
                :createdAt,
                :updatedAt
            )'
        );

        $statement->execute([
            ':categoryId' => $categoryIdByName['快速上手'] ?? 1,
            ':title' => '如何检查更新',
            ':contentMd' => "进入 `设置 -> 检查更新` 可手动触发更新检查。\n\n当返回强制更新时，客户端会进入阻断页。",
            ':keywords' => '更新,升级,版本',
            ':viewCount' => 0,
            ':isActive' => 1,
            ':sortOrder' => 10,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);

        $statement->execute([
            ':categoryId' => $categoryIdByName['常见问题'] ?? 2,
            ':title' => '反馈工单多久处理',
            ':contentMd' => "提交工单后可以在反馈列表查看状态。\n\n状态包括 `OPEN`, `PROCESSING`, `WAITING_USER`, `RESOLVED`, `CLOSED`。",
            ':keywords' => '反馈,工单,状态',
            ':viewCount' => 0,
            ':isActive' => 1,
            ':sortOrder' => 20,
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);
    }

    $pdo->commit();
    echo "Seed completed successfully.\n";
} catch (Throwable $exception) {
    $pdo->rollBack();
    fwrite(STDERR, 'Seed failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
