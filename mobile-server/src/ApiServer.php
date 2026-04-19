<?php

declare(strict_types=1);

namespace MobileServer;

use PDO;
use Throwable;

final class ApiServer
{
    private Database $database;
    private string $basePath;
    private string $apiKey;

    public function __construct(Database $database, string $basePath, string $apiKey)
    {
        $this->database = $database;
        $this->basePath = rtrim($basePath, '/');
        $this->apiKey = $apiKey;
    }

    public function handle(): void
    {
        $this->applyCorsHeaders();

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'OPTIONS') {
            JsonResponse::noContent(204);
            return;
        }

        $path = $this->requestPath();
        if (!str_starts_with($path, $this->basePath)) {
            JsonResponse::error('Not Found', 404);
            return;
        }

        $route = substr($path, strlen($this->basePath));
        if ($route === false || $route === '') {
            $route = '/';
        }

        if ($method === 'GET' && $route === '/health') {
            JsonResponse::send([
                'ok' => true,
                'service' => 'mobile-server',
            ]);
            return;
        }

        if (!$this->isAuthorized()) {
            JsonResponse::error('Unauthorized', 401);
            return;
        }

        try {
            if ($method === 'GET' && $route === '/announcements') {
                $this->getAnnouncements();
                return;
            }

            if ($method === 'GET' && $route === '/app-versions/check') {
                $this->checkVersion();
                return;
            }

            if ($method === 'GET' && $route === '/help/categories') {
                $this->getHelpCategories();
                return;
            }

            if ($method === 'GET' && $route === '/help/articles') {
                $this->getHelpArticles();
                return;
            }

            if ($method === 'GET' && preg_match('#^/help/articles/(\d+)$#', $route, $matches) === 1) {
                $this->getHelpArticleById((int) $matches[1]);
                return;
            }

            if ($method === 'POST' && $route === '/feedback/tickets') {
                $this->createFeedbackTicket();
                return;
            }

            if ($method === 'GET' && $route === '/feedback/tickets') {
                $this->getFeedbackTickets();
                return;
            }

            if ($method === 'GET' && preg_match('#^/feedback/tickets/([A-Za-z0-9_-]+)$#', $route, $matches) === 1) {
                $this->getFeedbackTicketDetail($matches[1]);
                return;
            }

            JsonResponse::error('Not Found', 404);
        } catch (Throwable $exception) {
            if (Config::isProduction()) {
                JsonResponse::error('Internal Server Error', 500);
                return;
            }

            JsonResponse::send([
                'message' => 'Internal Server Error',
                'error' => $exception->getMessage(),
            ], 500);
        }
    }

    private function getAnnouncements(): void
    {
        $page = $this->queryInt('page', 1, 1, 1000000);
        $pageSize = $this->queryInt('pageSize', 20, 1, 100);
        $offset = ($page - 1) * $pageSize;

        $pdo = $this->database->pdo();
        $now = gmdate('Y-m-d H:i:s');

        $countStatement = $pdo->prepare(
            'SELECT COUNT(1) AS total
             FROM announcements
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= :now)
               AND (ends_at IS NULL OR ends_at >= :now)'
        );
        $countStatement->execute([':now' => $now]);
        $total = (int) ($countStatement->fetch()['total'] ?? 0);

        $itemsStatement = $pdo->prepare(
            'SELECT id,
                    title,
                    content,
                    is_active AS isActive,
                    priority,
                    starts_at AS startsAt,
                    ends_at AS endsAt,
                    created_at AS createdAt
             FROM announcements
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= :now)
               AND (ends_at IS NULL OR ends_at >= :now)
             ORDER BY priority DESC, created_at DESC
             LIMIT :limit OFFSET :offset'
        );
        $itemsStatement->bindValue(':now', $now);
        $itemsStatement->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $itemsStatement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $itemsStatement->execute();

        $rows = $itemsStatement->fetchAll();

        JsonResponse::send([
            'items' => array_map(fn (array $row): array => $this->mapAnnouncement($row), $rows),
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $total,
        ]);
    }

    private function checkVersion(): void
    {
        $platform = strtolower(trim((string) ($_GET['platform'] ?? '')));
        if (!in_array($platform, ['android', 'ios'], true)) {
            JsonResponse::error('Invalid platform. Allowed values: android, ios', 400);
            return;
        }

        $buildNumber = $this->queryInt('buildNumber', 0, 0, 2147483647);

        $statement = $this->database->pdo()->prepare(
            'SELECT version_name,
                    build_number,
                    download_url,
                    release_notes,
                    force_update,
                    min_supported_build
             FROM app_versions
             WHERE platform = :platform
               AND status = :status
             ORDER BY build_number DESC
             LIMIT 1'
        );
        $statement->execute([
            ':platform' => $platform,
            ':status' => 'PUBLISHED',
        ]);

        $latest = $statement->fetch();
        if ($latest === false) {
            JsonResponse::send([
                'hasUpdate' => false,
                'forceUpdate' => false,
                'latestVersion' => null,
                'downloadUrl' => null,
                'releaseNotes' => '',
            ]);
            return;
        }

        $latestBuild = (int) $latest['build_number'];
        $hasUpdate = $latestBuild > $buildNumber;
        $minSupportedBuild = (int) $latest['min_supported_build'];
        $forceUpdate = $hasUpdate && ((int) $latest['force_update'] === 1 || $buildNumber < $minSupportedBuild);

        JsonResponse::send([
            'hasUpdate' => $hasUpdate,
            'forceUpdate' => $forceUpdate,
            'latestVersion' => $hasUpdate ? (string) $latest['version_name'] : null,
            'downloadUrl' => $hasUpdate ? (string) $latest['download_url'] : null,
            'releaseNotes' => $hasUpdate ? (string) $latest['release_notes'] : '',
        ]);
    }

    private function getHelpCategories(): void
    {
        $statement = $this->database->pdo()->query(
            'SELECT id,
                    name,
                    sort_order AS sortOrder,
                    is_active AS isActive
             FROM help_categories
             WHERE is_active = 1
             ORDER BY sort_order ASC, id ASC'
        );

        $rows = $statement->fetchAll();

        JsonResponse::send([
            'data' => array_map(fn (array $row): array => $this->mapHelpCategory($row), $rows),
        ]);
    }

    private function getHelpArticles(): void
    {
        $page = $this->queryInt('page', 1, 1, 1000000);
        $pageSize = $this->queryInt('pageSize', 20, 1, 100);
        $offset = ($page - 1) * $pageSize;
        $categoryId = isset($_GET['categoryId']) && $_GET['categoryId'] !== ''
            ? $this->queryInt('categoryId', 0, 1, 2147483647)
            : null;
        $keyword = isset($_GET['keyword']) ? trim((string) $_GET['keyword']) : null;
        if ($keyword === '') {
            $keyword = null;
        }

        $conditions = ['is_active = 1'];
        $params = [];

        if ($categoryId !== null) {
            $conditions[] = 'category_id = :categoryId';
            $params[':categoryId'] = $categoryId;
        }

        if ($keyword !== null) {
            $conditions[] = '(title LIKE :keyword OR keywords LIKE :keyword OR content_md LIKE :keyword)';
            $params[':keyword'] = '%' . $keyword . '%';
        }

        $whereSql = implode(' AND ', $conditions);

        $countStatement = $this->database->pdo()->prepare(
            'SELECT COUNT(1) AS total FROM help_articles WHERE ' . $whereSql
        );
        foreach ($params as $param => $value) {
            $countStatement->bindValue($param, $value);
        }
        $countStatement->execute();
        $total = (int) ($countStatement->fetch()['total'] ?? 0);

        $itemsStatement = $this->database->pdo()->prepare(
            'SELECT id,
                    category_id AS categoryId,
                    title,
                    content_md AS contentMd,
                    keywords,
                    view_count AS viewCount,
                    is_active AS isActive,
                    sort_order AS sortOrder,
                    created_at AS createdAt,
                    updated_at AS updatedAt
             FROM help_articles
             WHERE ' . $whereSql . '
             ORDER BY sort_order ASC, id DESC
             LIMIT :limit OFFSET :offset'
        );
        foreach ($params as $param => $value) {
            $itemsStatement->bindValue($param, $value);
        }
        $itemsStatement->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $itemsStatement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $itemsStatement->execute();

        $rows = $itemsStatement->fetchAll();

        JsonResponse::send([
            'items' => array_map(fn (array $row): array => $this->mapHelpArticle($row), $rows),
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $total,
        ]);
    }

    private function getHelpArticleById(int $id): void
    {
        $updateStatement = $this->database->pdo()->prepare(
            'UPDATE help_articles
             SET view_count = view_count + 1,
                 updated_at = :updatedAt
             WHERE id = :id
               AND is_active = 1'
        );
        $updateStatement->execute([
            ':id' => $id,
            ':updatedAt' => gmdate('Y-m-d H:i:s'),
        ]);

        if ($updateStatement->rowCount() === 0) {
            JsonResponse::error('Article not found', 404);
            return;
        }

        $selectStatement = $this->database->pdo()->prepare(
            'SELECT id,
                    category_id AS categoryId,
                    title,
                    content_md AS contentMd,
                    keywords,
                    view_count AS viewCount,
                    is_active AS isActive,
                    sort_order AS sortOrder,
                    created_at AS createdAt,
                    updated_at AS updatedAt
             FROM help_articles
             WHERE id = :id'
        );
        $selectStatement->execute([':id' => $id]);
        $article = $selectStatement->fetch();

        if (!is_array($article)) {
            JsonResponse::error('Article not found', 404);
            return;
        }

        JsonResponse::send([
            'data' => $this->mapHelpArticle($article),
        ]);
    }

    private function createFeedbackTicket(): void
    {
        $body = $this->jsonBody();
        if ($body === null) {
            return;
        }

        $requiredFields = ['type', 'title', 'content', 'sourcePlatform'];
        foreach ($requiredFields as $field) {
            if (!isset($body[$field]) || trim((string) $body[$field]) === '') {
                JsonResponse::error('Missing required field: ' . $field, 400);
                return;
            }
        }

        $type = trim((string) $body['type']);
        $sourcePlatform = strtolower(trim((string) $body['sourcePlatform']));

        $ticketNo = $this->generateTicketNo();
        $now = gmdate('Y-m-d H:i:s');

        $statement = $this->database->pdo()->prepare(
            'INSERT INTO feedback_tickets (
                ticket_no,
                user_id,
                user_name,
                contact,
                type,
                title,
                content,
                status,
                source_platform,
                app_version,
                device_info,
                created_at,
                updated_at
            ) VALUES (
                :ticketNo,
                :userId,
                :userName,
                :contact,
                :type,
                :title,
                :content,
                :status,
                :sourcePlatform,
                :appVersion,
                :deviceInfo,
                :createdAt,
                :updatedAt
            )'
        );

        $statement->execute([
            ':ticketNo' => $ticketNo,
            ':userId' => $this->optionalString($body['userId'] ?? null),
            ':userName' => $this->optionalString($body['userName'] ?? null),
            ':contact' => $this->optionalString($body['contact'] ?? null),
            ':type' => $type,
            ':title' => trim((string) $body['title']),
            ':content' => trim((string) $body['content']),
            ':status' => 'OPEN',
            ':sourcePlatform' => $sourcePlatform,
            ':appVersion' => $this->optionalString($body['appVersion'] ?? null),
            ':deviceInfo' => $this->optionalString($body['deviceInfo'] ?? null),
            ':createdAt' => $now,
            ':updatedAt' => $now,
        ]);

        $ticket = $this->findTicketByNo($ticketNo);
        JsonResponse::send([
            'data' => $ticket,
        ], 201);
    }

    private function getFeedbackTickets(): void
    {
        $page = $this->queryInt('page', 1, 1, 1000000);
        $pageSize = $this->queryInt('pageSize', 20, 1, 100);
        $offset = ($page - 1) * $pageSize;
        $userId = isset($_GET['userId']) ? trim((string) $_GET['userId']) : null;
        if ($userId === '') {
            $userId = null;
        }

        $conditions = [];
        $params = [];

        if ($userId !== null) {
            $conditions[] = 'user_id = :userId';
            $params[':userId'] = $userId;
        }

        $whereSql = count($conditions) > 0 ? ('WHERE ' . implode(' AND ', $conditions)) : '';

        $countStatement = $this->database->pdo()->prepare(
            'SELECT COUNT(1) AS total FROM feedback_tickets ' . $whereSql
        );
        foreach ($params as $param => $value) {
            $countStatement->bindValue($param, $value);
        }
        $countStatement->execute();
        $total = (int) ($countStatement->fetch()['total'] ?? 0);

        $itemsStatement = $this->database->pdo()->prepare(
            'SELECT id,
                    ticket_no AS ticketNo,
                    user_id AS userId,
                    user_name AS userName,
                    contact,
                    type,
                    title,
                    content,
                    status,
                    source_platform AS sourcePlatform,
                    app_version AS appVersion,
                    device_info AS deviceInfo,
                    created_at AS createdAt,
                    updated_at AS updatedAt
             FROM feedback_tickets
             ' . $whereSql . '
             ORDER BY id DESC
             LIMIT :limit OFFSET :offset'
        );
        foreach ($params as $param => $value) {
            $itemsStatement->bindValue($param, $value);
        }
        $itemsStatement->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $itemsStatement->bindValue(':offset', $offset, PDO::PARAM_INT);
        $itemsStatement->execute();

        $rows = $itemsStatement->fetchAll();

        JsonResponse::send([
            'items' => array_map(fn (array $row): array => $this->mapFeedbackTicket($row), $rows),
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $total,
        ]);
    }

    private function getFeedbackTicketDetail(string $ticketNo): void
    {
        $ticket = $this->findTicketByNo($ticketNo);
        if ($ticket === null) {
            JsonResponse::error('Feedback ticket not found', 404);
            return;
        }

        JsonResponse::send([
            'data' => $ticket,
        ]);
    }

    private function findTicketByNo(string $ticketNo): ?array
    {
        $statement = $this->database->pdo()->prepare(
            'SELECT id,
                    ticket_no AS ticketNo,
                    user_id AS userId,
                    user_name AS userName,
                    contact,
                    type,
                    title,
                    content,
                    status,
                    source_platform AS sourcePlatform,
                    app_version AS appVersion,
                    device_info AS deviceInfo,
                    created_at AS createdAt,
                    updated_at AS updatedAt
             FROM feedback_tickets
             WHERE ticket_no = :ticketNo
             LIMIT 1'
        );
        $statement->execute([':ticketNo' => $ticketNo]);

        $ticket = $statement->fetch();
        if (!is_array($ticket)) {
            return null;
        }

        return $this->mapFeedbackTicket($ticket);
    }

    private function generateTicketNo(): string
    {
        return 'FB' . gmdate('YmdHis') . random_int(100, 999);
    }

    private function queryInt(string $key, int $default, int $min, int $max): int
    {
        $raw = $_GET[$key] ?? null;
        if ($raw === null || $raw === '') {
            return $default;
        }

        if (!is_numeric($raw)) {
            JsonResponse::error('Invalid query parameter: ' . $key, 400);
            exit;
        }

        $value = (int) $raw;
        if ($value < $min || $value > $max) {
            JsonResponse::error('Query parameter out of range: ' . $key, 400);
            exit;
        }

        return $value;
    }

    private function jsonBody(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            JsonResponse::error('Request body is required', 400);
            return null;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            JsonResponse::error('Invalid JSON body', 400);
            return null;
        }

        return $decoded;
    }

    private function optionalString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);
        return $text === '' ? null : $text;
    }

    private function requestPath(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH);
        if (!is_string($path) || $path === '') {
            return '/';
        }

        // 移除 SCRIPT_NAME 前缀（如 /public/index.php）
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        if ($scriptName !== '' && str_starts_with($path, $scriptName)) {
            $path = substr($path, strlen($scriptName));
            if ($path === false || $path === '') {
                return '/';
            }
        }

        return $path;
    }

    private function applyCorsHeaders(): void
    {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Content-Type, Accept, X-Mobile-Api-Key');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    }

    private function isAuthorized(): bool
    {
        $receivedApiKey = $_SERVER['HTTP_X_MOBILE_API_KEY'] ?? '';
        return hash_equals($this->apiKey, (string) $receivedApiKey);
    }

    private function mapAnnouncement(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'content' => (string) $row['content'],
            'isActive' => (int) $row['isActive'],
            'priority' => (int) $row['priority'],
            'startsAt' => $row['startsAt'] !== null ? (string) $row['startsAt'] : null,
            'endsAt' => $row['endsAt'] !== null ? (string) $row['endsAt'] : null,
            'createdAt' => (string) $row['createdAt'],
        ];
    }

    private function mapHelpCategory(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'sortOrder' => (int) $row['sortOrder'],
            'isActive' => (int) $row['isActive'],
        ];
    }

    private function mapHelpArticle(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'categoryId' => (int) $row['categoryId'],
            'title' => (string) $row['title'],
            'contentMd' => (string) $row['contentMd'],
            'keywords' => (string) $row['keywords'],
            'viewCount' => (int) $row['viewCount'],
            'isActive' => (int) $row['isActive'],
            'sortOrder' => (int) $row['sortOrder'],
            'createdAt' => (string) $row['createdAt'],
            'updatedAt' => (string) $row['updatedAt'],
        ];
    }

    private function mapFeedbackTicket(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'ticketNo' => (string) $row['ticketNo'],
            'userId' => $row['userId'] !== null ? (string) $row['userId'] : null,
            'userName' => $row['userName'] !== null ? (string) $row['userName'] : null,
            'contact' => $row['contact'] !== null ? (string) $row['contact'] : null,
            'type' => (string) $row['type'],
            'title' => (string) $row['title'],
            'content' => (string) $row['content'],
            'status' => (string) $row['status'],
            'sourcePlatform' => (string) $row['sourcePlatform'],
            'appVersion' => $row['appVersion'] !== null ? (string) $row['appVersion'] : null,
            'deviceInfo' => $row['deviceInfo'] !== null ? (string) $row['deviceInfo'] : null,
            'createdAt' => (string) $row['createdAt'],
            'updatedAt' => (string) $row['updatedAt'],
        ];
    }
}
