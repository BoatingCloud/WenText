# 使用文档

本文档面向首次接手项目的开发者、测试人员与部署人员，说明本项目如何启动、配置与使用。

## 1. 项目组成

核心运行链路：

- `server/`：后端 API 与业务服务
- `client/`：用户端
- `admin/`：管理后台
- `docker/`：开发与生产环境编排

扩展模块：

- `mobile/`：Flutter 移动端
- `mobile-server/`：移动端公告/版本/帮助中心/工单服务

## 2. 开发环境启动

### Docker 开发模式

推荐用于第一次启动项目。

```bash
cd docker
./start-dev.sh
```

启动后地址如下：

- 用户端：`http://localhost:5173`
- 管理后台：`http://localhost:5174`
- API：`http://localhost:3000`
- OnlyOffice：`http://localhost:3001`
- MinIO 控制台：`http://localhost:9001`
- Elasticsearch：`http://localhost:9200`

停止开发环境：

```bash
cd docker
./stop-dev.sh
```

### 本地 Node 工作区模式

```bash
npm install
cp server/.env.example server/.env
npm run db:generate
npm run db:migrate
npm run dev
```

## 3. 关键环境变量

`server/.env.example` 已提供示例，常用项如下：

- `DATABASE_URL`：PostgreSQL 连接串
- `REDIS_URL` 或 `REDIS_HOST/REDIS_PORT`
- `JWT_SECRET`
- `UPLOAD_MAX_SIZE`
- `STORAGE_BASE_PATH`
- `MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
- `ELASTICSEARCH_NODE`
- `CORS_ORIGIN`
- `ONLYOFFICE_ENABLED`
- `ONLYOFFICE_URL`
- `ONLYOFFICE_SERVICE_URL`
- `ONLYOFFICE_INTERNAL_SERVER_URL`
- `ONLYOFFICE_JWT_SECRET`

## 4. 默认业务链路

### 用户与权限

1. 管理员登录系统
2. 配置组织树与部门
3. 创建角色并分配权限
4. 创建用户并绑定角色
5. 视情况分配公司范围、仓库范围、档案范围权限

### 电子文档管理

1. 创建仓库
2. 设置仓库权限
3. 上传文件或创建目录
4. 浏览、预览、下载、移动、重命名
5. 需要协作时创建分享或启用 OnlyOffice

### 实体档案管理

1. 配置档案分类
2. 新建实体档案
3. 提交审核并归档
4. 需要时执行借阅、归还、销毁
5. 在统计页查看借阅与库存数据

### 文档审查

1. 创建审查单
2. 上传待审附件
3. 触发 AI 审查
4. 使用人工标注补充问题点
5. 按工作流执行提交、审批、驳回

## 5. 管理后台与用户端说明

### 用户端 `client/`

主要页面入口：

- 登录、注册、忘记密码
- 仪表盘
- 文件浏览器
- 在线编辑器
- 分享访问页
- 个人中心
- 若用户具备权限，也可进入部分后台管理页

### 管理后台 `admin/`

主要页面入口：

- 用户管理
- 角色管理
- 仓库管理
- 实体档案管理
- 档案分类管理
- 借阅工作流配置
- 借阅审批
- 文档审查
- 审计日志
- 系统配置

## 6. 生产部署

```bash
cd docker
docker compose build
docker compose up -d
```

默认端口：

- 用户端：`80`
- 管理后台：`8080`
- 后端容器映射端口：`4000`
- PostgreSQL：`5432`
- Redis：`6379`
- MinIO：`9000/9001`
- OnlyOffice：`3001`

说明：

- 生产环境编排文件为 `docker/docker-compose.yml`
- 后端生产容器内部端口为 `3000`，宿主机映射为 `4000`
- 若前端或管理后台需要访问后端，部署时要确认网关或反向代理配置一致

## 7. 数据与文件

- Prisma 模型：`server/prisma/schema.prisma`
- 开发数据目录：`docker-data/`
- 文档审查附件目录：`/data/storage/document-reviews`
- 签名图片目录：`uploads/signatures`

建议：

- GitHub 发布时不要提交 `docker-data/`、`uploads/`、本地数据库文件、日志与构建产物

## 8. 常用命令

```bash
# 根工作区开发
npm run dev

# 构建全部工作区
npm run build

# 仅构建后端
npm run build:server

# 仅构建用户端
npm run build:client

# 仅构建管理后台
npm run build:admin

# 运行 Prisma 迁移
npm run db:migrate

# 生成 Prisma Client
npm run db:generate
```

## 9. GitHub 发布建议

发布前建议按下面顺序检查：

1. 删除本地产物，如 `node_modules`、`dist`、移动端构建目录、`.DS_Store`
2. 确认 `.env`、日志、缓存目录未进入仓库
3. 保留 `server/.env.example` 等示例配置
4. 检查 `README.md`、`docs/API.md`、`docs/USAGE.md` 是否与代码一致
5. 若准备公开仓库，补充 `LICENSE`

## 10. 已知现状

- 根工作区当前未纳入 `mobile/` 与 `mobile-server/` 的统一构建流程
- `mobile/README.md` 仍是 Flutter 默认模板，后续建议单独补齐移动端业务文档
- 项目当前主要依赖手写文档，尚未接入 Swagger/OpenAPI 自动生成
