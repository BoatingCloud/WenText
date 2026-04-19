# 部署说明

## 上传即用部署方式

### 1. 上传文件

将整个 `mobile-server` 文件夹上传到你的 PHP 服务器，例如：
- `/var/www/html/mobile-server/`
- `/home/username/public_html/mobile-server/`

### 2. 设置权限

确保 `storage` 目录可写：

```bash
chmod 775 storage
```

或者通过 FTP 客户端设置目录权限为 775。

### 3. 访问服务

直接访问：`http://你的域名/mobile-server/public/index.php`

首次访问时会自动：
- 创建 SQLite 数据库文件 `storage/mobile.sqlite`
- 初始化所有数据表
- 插入示例数据（公告、版本、帮助文章等）

### 4. 健康检查

访问：`http://你的域名/mobile-server/public/index.php/mobile-api/health`

应该返回：
```json
{
  "ok": true,
  "service": "mobile-server"
}
```

## 管理后台

### 访问管理后台

访问：`http://你的域名/mobile-server/public/admin.php`

**默认密码：** `admin123`

**重要：** 请立即修改密码！编辑 `public/admin.php` 文件第 11 行：

```php
define('ADMIN_PASSWORD', 'your_secure_password_here');
```

### 管理后台功能

- 📢 **公告管理** - 添加、编辑、删除公告，设置优先级和有效期
- 🔄 **版本管理** - 管理 Android/iOS 版本，设置强制更新
- 📁 **帮助分类** - 管理帮助中心分类
- 📝 **帮助文章** - 管理帮助文章，支持 Markdown
- 💬 **反馈工单** - 查看和处理用户反馈

## 配置（可选）

### 修改 API Key

默认 API Key 是 `dev_mobile_api_key`，生产环境建议修改。

**方法 1：通过 .env 文件**

在项目根目录创建或修改 `.env` 文件：
```
MOBILE_API_KEY=your_secure_api_key_here
```

**方法 2：通过服务器环境变量**

在 Apache 的 `.htaccess` 或虚拟主机配置中：
```apache
SetEnv MOBILE_API_KEY "your_secure_api_key_here"
```

在 Nginx 的配置中：
```nginx
fastcgi_param MOBILE_API_KEY "your_secure_api_key_here";
```

### 其他配置项

- `MOBILE_SQLITE_PATH`: SQLite 数据库路径（默认：`storage/mobile.sqlite`）
- `MOBILE_API_BASE_PATH`: API 基础路径（默认：`/mobile-api`）
- `APP_ENV`: 设置为 `production` 隐藏错误详情

## URL 重写（可选）

### Apache (.htaccess)

在 `public` 目录创建 `.htaccess`：

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]
```

然后可以直接访问：`http://你的域名/mobile-server/public/mobile-api/health`

### Nginx

```nginx
location /mobile-server/public {
    try_files $uri $uri/ /mobile-server/public/index.php?$query_string;
}
```

## 测试 API

### 获取公告列表

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://你的域名/mobile-server/public/index.php/mobile-api/announcements'
```

### 检查版本更新

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://你的域名/mobile-server/public/index.php/mobile-api/app-versions/check?platform=android&buildNumber=90'
```

### 获取帮助分类

```bash
curl -H 'X-Mobile-Api-Key: dev_mobile_api_key' \
  'http://你的域名/mobile-server/public/index.php/mobile-api/help/categories'
```

## 常见问题

### 1. 500 错误

检查 `storage` 目录权限是否可写。

### 2. 数据库文件无法创建

确保 PHP 进程有权限在 `storage` 目录创建文件。

### 3. API 返回 401 Unauthorized

检查请求头是否包含正确的 `X-Mobile-Api-Key`。

### 4. 需要重新初始化数据库

删除 `storage/mobile.sqlite` 文件，再次访问即可自动重建。

## 生产环境建议

1. 修改默认 API Key
2. 设置 `APP_ENV=production` 隐藏错误详情
3. 定期备份 `storage/mobile.sqlite` 数据库文件
4. 配置 URL 重写以获得更友好的 URL
5. 使用 HTTPS 保护 API 通信
