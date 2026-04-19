<?php

declare(strict_types=1);

use MobileServer\ApiServer;
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

date_default_timezone_set('UTC');

$database = new Database(Config::sqlitePath());
$server = new ApiServer($database, Config::basePath(), Config::apiKey());
$server->handle();
