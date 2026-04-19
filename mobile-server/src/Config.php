<?php

declare(strict_types=1);

namespace MobileServer;

final class Config
{
    public const DEFAULT_API_KEY = 'dev_mobile_api_key';

    public static function apiKey(): string
    {
        $value = getenv('MOBILE_API_KEY');
        if ($value === false || trim($value) === '') {
            return self::DEFAULT_API_KEY;
        }

        return trim($value);
    }

    public static function basePath(): string
    {
        $value = getenv('MOBILE_API_BASE_PATH');
        if ($value === false || trim($value) === '') {
            return '/mobile-api';
        }

        $path = '/' . trim(trim($value), '/');
        return $path === '/' ? '/mobile-api' : $path;
    }

    public static function sqlitePath(): string
    {
        $value = getenv('MOBILE_SQLITE_PATH');
        if ($value !== false && trim($value) !== '') {
            return trim($value);
        }

        return dirname(__DIR__) . '/storage/mobile.sqlite';
    }

    public static function isProduction(): bool
    {
        $env = getenv('APP_ENV');
        return $env !== false && strtolower(trim($env)) === 'production';
    }
}
