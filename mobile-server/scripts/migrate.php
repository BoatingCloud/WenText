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

$migrationPath = dirname(__DIR__) . '/src/Database/migrations/001_init.sql';
$sql = file_get_contents($migrationPath);

if ($sql === false) {
    fwrite(STDERR, "Failed to read migration file: {$migrationPath}\n");
    exit(1);
}

$pdo->exec($sql);

echo "Migration applied: 001_init.sql\n";
