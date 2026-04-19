#!/bin/bash

# mobile-server 快速启动脚本
# 使用 Docker 运行 PHP 服务

cd "$(dirname "$0")"

echo "🚀 启动 mobile-server..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 停止旧容器
docker stop wenyu-mobile-server 2>/dev/null || true
docker rm wenyu-mobile-server 2>/dev/null || true

# 运行容器（使用 8081 端口避免与 admin 冲突）
docker run -d \
  --name wenyu-mobile-server \
  -p 8081:8080 \
  -v "$(pwd)":/app \
  -w /app \
  --restart unless-stopped \
  php:8.1-cli \
  sh -c "php scripts/migrate.php && php scripts/seed.php && php -S 0.0.0.0:8080 -t public public/index.php"

echo "✅ mobile-server 已启动"
echo "📍 服务地址: http://localhost:8081"
echo "📍 健康检查: http://localhost:8081/mobile-api/health"
echo ""
echo "查看日志: docker logs -f wenyu-mobile-server"
echo "停止服务: docker stop wenyu-mobile-server"
