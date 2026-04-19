# mobile-server

`mobile-server` 是面向移动端的独立 API 服务，负责：

- 公告下发
- 版本检查（普通更新/强制更新）
- 帮助中心
- 反馈工单

主业务接口（认证、档案、仓库）仍由 `server/`（Node.js）提供。

## 技术栈

- PHP 8.1+
- SQLite
- 零第三方运行时依赖（框架无关）

## 快速部署（上传即用）

**只需 3 步：**

1. 将整个 `mobile-server` 文件夹上传到 PHP 服务器
2. 确保 `storage` 目录可写（chmod 775）
3. 访问 `http://你的域名/mobile-server/public/index.php`

**首次访问时会自动：**
- 创建 SQLite 数据库
- 初始化所有表结构
- 插入示例数据

无需运行任何命令，无需 composer，上传即可使用！

## 目录结构

```text
mobile-server/
├── composer.json
├── public/
│   └── index.php
├── scripts/
│   ├── migrate.php
│   └── seed.php
├── src/
│   ├── ApiServer.php
│   ├── Config.php
│   ├── Database.php
│   ├── JsonResponse.php
│   └── Database/
│       └── migrations/
│           └── 001_init.sql
└── storage/
```

## 环境变量

- `MOBILE_API_KEY`：接口鉴权 key，默认 `dev_mobile_api_key`
- `MOBILE_SQLITE_PATH`：SQLite 文件路径，默认 `mobile-server/storage/mobile.sqlite`
- `MOBILE_API_BASE_PATH`：API 基础路径，默认 `/mobile-api`
- `APP_ENV`：`production` 时隐藏内部错误细节

## 本地启动

```bash
cd mobile-server
composer run db:migrate
composer run db:seed
composer run serve
```

服务默认监听：`http://localhost:8080`

健康检查：`GET /mobile-api/health`

## API 列表

所有业务接口都需要请求头：`X-Mobile-Api-Key: <MOBILE_API_KEY>`

- `GET /mobile-api/announcements`
- `GET /mobile-api/app-versions/check?platform=android|ios&buildNumber=100`
- `GET /mobile-api/help/categories`
- `GET /mobile-api/help/articles?page=1&pageSize=20&categoryId=1&keyword=更新`
- `GET /mobile-api/help/articles/{id}`
- `POST /mobile-api/feedback/tickets`
- `GET /mobile-api/feedback/tickets?page=1&pageSize=20&userId=u123`
- `GET /mobile-api/feedback/tickets/{ticketNo}`

## 示例请求

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8080/mobile-api/announcements?page=1&pageSize=20'
```

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8080/mobile-api/app-versions/check?platform=android&buildNumber=90'
```

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://localhost:8080/mobile-api/feedback/tickets' \
  -d '{
    "userId": "u_1001",
    "userName": "Alice",
    "contact": "alice@example.com",
    "type": "bug",
    "title": "上传失败",
    "content": "Android 14 下上传进度停在 90%",
    "sourcePlatform": "android",
    "appVersion": "1.0.0",
    "deviceInfo": "Pixel 8"
  }'
```
