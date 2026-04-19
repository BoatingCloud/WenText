# Docker 开发环境说明

## 目录结构

```
wenyu/
├── server/          # 后端源码
├── client/          # 前端源码
├── admin/           # 管理后台源码
├── docker/          # Docker 配置
│   ├── docker-compose.yml      # 生产环境配置
│   ├── docker-compose.dev.yml  # 开发环境配置
│   ├── start-dev.sh            # 启动开发环境脚本
│   └── stop-dev.sh             # 停止开发环境脚本
└── docker-data/     # 数据存储目录(不提交到git)
    ├── postgres/    # PostgreSQL 数据
    ├── redis/       # Redis 数据
    ├── minio/       # MinIO 对象存储
    ├── elasticsearch/ # Elasticsearch 数据
    ├── storage/     # 文件存储
    ├── storage-backup/ # 备份存储
    ├── logs/        # 日志文件
    ├── onlyoffice/  # OnlyOffice 数据
    └── onlyoffice-logs/ # OnlyOffice 日志
```

## 开发环境特点

### 源码挂载
- 所有源码目录都挂载到容器中
- 修改代码后自动热更新,无需重新构建镜像
- `node_modules` 和 `dist` 使用匿名卷,不污染源码目录

### 数据存储
- 所有数据存储在 `docker-data/` 目录
- 该目录已添加到 `.gitignore`,不会提交到版本控制
- 数据与源码分离,方便备份和清理

### 端口映射
- 后端API: `http://localhost:3000`
- 前端应用: `http://localhost:5173` (Vite 开发服务器)
- 管理后台: `http://localhost:5174` (Vite 开发服务器)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `http://localhost:9000` (API), `http://localhost:9001` (控制台)
- Elasticsearch: `http://localhost:9200`
- OnlyOffice: `http://localhost:3001`

## 使用方法

### 启动开发环境

```bash
cd docker
./start-dev.sh
```

或者手动启动:

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
```

### 查看日志

查看所有服务日志:
```bash
docker compose -f docker-compose.dev.yml logs -f
```

查看特定服务日志:
```bash
docker compose -f docker-compose.dev.yml logs -f server
docker compose -f docker-compose.dev.yml logs -f client
docker compose -f docker-compose.dev.yml logs -f admin
```

### 停止开发环境

```bash
cd docker
./stop-dev.sh
```

或者手动停止:

```bash
cd docker
docker compose -f docker-compose.dev.yml down
```

### 重启某个服务

```bash
docker compose -f docker-compose.dev.yml restart server
docker compose -f docker-compose.dev.yml restart client
docker compose -f docker-compose.dev.yml restart admin
```

### 进入容器

```bash
docker compose -f docker-compose.dev.yml exec server sh
docker compose -f docker-compose.dev.yml exec client sh
docker compose -f docker-compose.dev.yml exec admin sh
```

### 清理数据

如果需要清理所有数据重新开始:

```bash
# 停止容器
docker compose -f docker-compose.dev.yml down

# 删除数据目录
rm -rf ../docker-data/*

# 重新启动
./start-dev.sh
```

## 开发流程

1. **启动开发环境**
   ```bash
   cd docker
   ./start-dev.sh
   ```

2. **修改代码**
   - 后端: 修改 `server/src/` 下的文件,tsx watch 会自动重启
   - 前端: 修改 `client/src/` 下的文件,Vite 会自动热更新
   - 管理后台: 修改 `admin/src/` 下的文件,Vite 会自动热更新

3. **查看效果**
   - 前端: 浏览器访问 `http://localhost:5173`
   - 管理后台: 浏览器访问 `http://localhost:5174`
   - API: 使用 Postman 或 curl 访问 `http://localhost:3000`

4. **调试**
   - 查看日志: `docker compose -f docker-compose.dev.yml logs -f [service]`
   - 进入容器: `docker compose -f docker-compose.dev.yml exec [service] sh`

## 生产环境

生产环境使用 `docker-compose.yml`,会构建镜像:

```bash
cd docker

# 构建镜像
docker compose build

# 启动服务
docker compose up -d

# 停止服务
docker compose down
```

## 注意事项

1. **首次启动较慢**: 需要下载镜像和安装依赖,请耐心等待
2. **node_modules**: 使用匿名卷,不会污染源码目录
3. **数据持久化**: 所有数据存储在 `docker-data/` 目录
4. **端口冲突**: 确保端口 3000, 5173, 5174, 5432, 6379, 9000, 9001, 9200, 3001 未被占用
5. **内存要求**: Elasticsearch 需要至少 2GB 内存

## 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
lsof -i :3000
lsof -i :5173

# 停止占用端口的进程
kill -9 <PID>
```

### 2. 容器启动失败

```bash
# 查看容器状态
docker compose -f docker-compose.dev.yml ps

# 查看容器日志
docker compose -f docker-compose.dev.yml logs [service]

# 重新启动
docker compose -f docker-compose.dev.yml restart [service]
```

### 3. 依赖安装失败

```bash
# 进入容器手动安装
docker compose -f docker-compose.dev.yml exec server sh
npm install

# 或者重新构建
docker compose -f docker-compose.dev.yml up -d --force-recreate server
```

### 4. 数据库迁移

```bash
# 进入 server 容器
docker compose -f docker-compose.dev.yml exec server sh

# 运行迁移
npx prisma migrate deploy

# 或者创建新迁移
npx prisma migrate dev --name <migration_name>
```
