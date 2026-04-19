<?php

declare(strict_types=1);

namespace MobileServer;

final class JsonResponse
{
    public static function send(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function error(string $message, int $status): void
    {
        self::send(['message' => $message], $status);
    }

    public static function noContent(int $status = 204): void
    {
        http_response_code($status);
    }
}
