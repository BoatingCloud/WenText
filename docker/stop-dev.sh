#!/bin/bash

# 开发环境停止脚本

echo "正在停止开发环境..."
docker compose -f docker-compose.dev.yml down

echo ""
echo "开发环境已停止!"
