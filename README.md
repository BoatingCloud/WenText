# 文雨档案管理系统

文雨档案管理系统是一个面向企业场景的档案全生命周期管理平台，覆盖电子文档、实体档案、借阅审批、文档审查、在线预览、角色权限、审计日志与统计分析。

仓库当前以 `server + client + admin + docker` 为主线，另包含移动端 `mobile/` 与移动端独立服务 `mobile-server/` 两个扩展模块。

## 核心能力

- 电子档案管理：仓库、目录、上传下载、版本记录、移动重命名、分享访问、全文检索
- 实体档案管理：分类、建档、借阅、归还、审核、销毁、附件管理
- 文档审查：审查单、附件、AI 审查、审批流、人工标注、OnlyOffice 只读预览
- 权限体系：用户、角色、组织树、仓库权限、公司范围权限、档案权限
- 系统治理：系统配置、AI 配置、审计日志、审批待办、统计报表

## 技术栈

- 后端：Node.js、TypeScript、Express、Prisma、PostgreSQL、Redis
- 前端用户端：React 18、TypeScript、Vite、Ant Design、TanStack Query
- 管理后台：React 18、TypeScript、Vite、Ant Design、Ant Design Pro Components
- 扩展能力：Elasticsearch、MinIO、OnlyOffice、WebSocket 协作
- 移动端扩展：Flutter 客户端、PHP + SQLite 移动端服务

## 仓库结构

```text
.
├── server/          # Node.js 后端
├── client/          # 用户端前端
├── admin/           # 管理后台
├── docker/          # Docker 开发/生产编排
├── mobile/          # Flutter 移动端
├── mobile-server/   # PHP 移动端补充服务
├── docs/            # 项目文档
└── scripts/         # 辅助脚本
```

## 快速开始

### 方式一：Docker 开发环境

```bash
cd docker
./start-dev.sh
```

默认访问地址：

- 用户端：`http://localhost:5173`
- 管理后台：`http://localhost:5174`
- 后端 API：`http://localhost:3000`
- OnlyOffice：`http://localhost:3001`
- MinIO 控制台：`http://localhost:9001`

### 方式二：本地工作区启动

```bash
npm install
cp server/.env.example server/.env
npm run db:generate
npm run db:migrate
npm run dev
```

## 运行要求

- Node.js `>= 18`
- PostgreSQL `>= 14`
- Redis `>= 6`
- Docker / Docker Compose
- 可选：Elasticsearch、MinIO、OnlyOffice

## 文档入口

- [API 文档](./docs/API.md)
- [使用文档](./docs/USAGE.md)
- [Docker 说明](./docker/README.md)
- [移动端服务说明](./mobile-server/README.md)

## 主系统模块

### 后端 `server/`

- 路由入口位于 `server/src/routes/index.ts`
- 主要模块包括认证、用户、角色、部门、仓库、电子文档、实体档案、借阅流程、文档审查、人工标注、统计、审计日志
- 数据模型定义位于 `server/prisma/schema.prisma`

### 用户端 `client/`

- 登录注册、文件浏览、在线编辑、分享访问、个人中心
- 同时承载部分管理场景入口，如用户、角色、仓库、实体档案、文档审查页面

### 管理后台 `admin/`

- 聚焦系统治理与配置
- 覆盖用户、角色、仓库、实体档案、审批配置、审计日志、系统配置、文档审查等管理场景

### 扩展模块

- `mobile/`：Flutter 客户端
- `mobile-server/`：面向移动端公告、版本检查、帮助中心、反馈工单的轻量服务


## 许可证

本仓库采用 [MIT License](./LICENSE)。
