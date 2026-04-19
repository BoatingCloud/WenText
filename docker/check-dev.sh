#!/bin/bash

# 检查开发环境状态

echo "检查容器状态..."
docker compose -f docker-compose.dev.yml ps

echo ""
echo "检查服务健康状态..."
echo ""

# 检查后端
echo -n "后端API (http://localhost:3000): "
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ 运行中"
else
    echo "✗ 未就绪 (可能还在启动中)"
fi

# 检查前端
echo -n "前端应用 (http://localhost:5173): "
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✓ 运行中"
else
    echo "✗ 未就绪 (可能还在启动中)"
fi

# 检查管理后台
echo -n "管理后台 (http://localhost:5174): "
if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "✓ 运行中"
else
    echo "✗ 未就绪 (可能还在启动中)"
fi

echo ""
echo "提示: 首次启动需要安装依赖,可能需要几分钟时间"
echo "查看详细日志: docker compose -f docker-compose.dev.yml logs -f [service]"
