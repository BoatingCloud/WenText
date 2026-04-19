#!/bin/bash

# 开发环境启动脚本

echo "正在启动开发环境..."

# 停止生产环境容器
echo "停止生产环境容器..."
docker compose -f docker-compose.yml down

# 启动开发环境
echo "启动开发环境容器..."
docker compose -f docker-compose.dev.yml up -d

echo ""
echo "开发环境已启动!"
echo ""
echo "服务访问地址:"
echo "  - 后端API:    http://localhost:3000"
echo "  - 前端应用:   http://localhost:5173"
echo "  - 管理后台:   http://localhost:5174"
echo "  - MinIO:      http://localhost:9001"
echo "  - OnlyOffice: http://localhost:3001"
echo ""
echo "查看日志:"
echo "  docker compose -f docker-compose.dev.yml logs -f [service]"
echo ""
echo "停止开发环境:"
echo "  docker compose -f docker-compose.dev.yml down"
