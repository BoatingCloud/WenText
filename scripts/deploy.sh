#!/bin/bash

set -e

echo "========================================"
echo "  文雨文档管理系统 - 一键部署脚本"
echo "========================================"
echo

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "错误: Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "项目目录: $PROJECT_DIR"
echo

# 创建 .env 文件（如果不存在）
if [ ! -f "$PROJECT_DIR/server/.env" ]; then
    echo "创建 server/.env 文件..."
    cp "$PROJECT_DIR/server/.env.example" "$PROJECT_DIR/server/.env"

    # 生成随机密钥
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)

    # 替换密钥
    sed -i.bak "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" "$PROJECT_DIR/server/.env"
    sed -i.bak "s/your-32-character-encryption-key/$ENCRYPTION_KEY/" "$PROJECT_DIR/server/.env"
    rm -f "$PROJECT_DIR/server/.env.bak"

    echo "已生成新的 JWT_SECRET 和 ENCRYPTION_KEY"
fi

# 进入 docker 目录
cd "$PROJECT_DIR/docker"

echo "开始构建和启动服务..."
echo

# 使用 docker compose 或 docker-compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# 构建镜像
$COMPOSE_CMD build

# 启动服务
$COMPOSE_CMD up -d

echo
echo "========================================"
echo "  部署完成!"
echo "========================================"
echo
echo "服务访问地址:"
echo "  - 用户端:      http://localhost"
echo "  - 管理后台:    http://localhost:8080"
echo "  - API 服务:    http://localhost:3000"
echo "  - MinIO 控制台: http://localhost:9001"
echo
echo "默认 MinIO 账号:"
echo "  - 用户名: minioadmin"
echo "  - 密码:   minioadmin"
echo
echo "查看日志:  $COMPOSE_CMD logs -f"
echo "停止服务:  $COMPOSE_CMD down"
echo "重启服务:  $COMPOSE_CMD restart"
echo
