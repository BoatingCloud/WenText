# 文雨文档管理系统 - Flutter移动端项目

## 📱 项目简介

**文雨文档管理系统移动端**是基于Flutter开发的跨平台客户端，支持iOS、Android和Web三端。项目采用Material Design 3设计语言，为用户提供便捷的移动端档案管理体验。

## 🎯 项目定位

作为**文雨文档管理系统**的移动端配套应用，主要面向需要随时随地访问档案的业务人员和管理者，提供轻量、高效的档案查阅和审批功能。

## ✨ 核心功能（规划）

| 模块 | 功能点 | 说明 |
|------|--------|------|
| **认证** | 登录/登出 | 支持密码登录、生物识别、记住密码 |
| **首页** | 工作台 | 快捷入口、最近访问、待办事项、公告 |
| **仓库** | 文档浏览 | 目录树、文件预览（图片/PDF/Office） |
| **档案** | 档案管理 | 列表查看、详情、搜索、借阅申请 |
| **审批** | 待办处理 | 借阅审批、申请查看 |
| **个人中心** | 用户信息 | 个人资料、关于应用、设置（主题/缓存/更新） |
| **辅助** | 帮助反馈 | 公告列表、帮助中心、工单提交 |

## 🏗️ 技术架构

```
文雨移动端
├── 前端框架：Flutter (3.x)
├── 设计语言：Material Design 3
├── 状态管理：Riverpod
├── 路由管理：GoRouter
├── 网络请求：Dio + 拦截器
├── 本地存储：Hive + SharedPreferences
├── 主题管理：FlexColorScheme
└── 多环境：.env + --dart-define
```

## 🔌 后端对接

项目需要对接两个API服务：

1. **主后端** (`api-reference.md`)
   - 基础路径：`/api`
   - 鉴权：`Bearer Token`
   - 核心业务：用户、仓库、档案、审批

2. **移动端API** (`mob-serverAPI.md`)
   - 基础路径：`/mobile-api`
   - 鉴权：`X-Mobile-Api-Key`
   - 辅助功能：公告、版本、帮助、反馈

## 📁 项目结构（规划）

```
lib/
├── main.dart                 # 应用入口
├── src/
│   ├── core/                 # 核心功能
│   │   ├── constants/        # 常量配置
│   │   ├── theme/            # 主题管理
│   │   ├── router/           # 路由配置
│   │   ├── network/          # 网络层（Dio封装）
│   │   └── storage/          # 本地存储
│   ├── features/             # 功能模块
│   │   ├── auth/             # 认证模块
│   │   ├── home/             # 首页工作台
│   │   ├── repository/       # 仓库浏览
│   │   ├── archive/          # 档案管理
│   │   ├── search/           # 搜索中心
│   │   ├── profile/          # 个人中心
│   │   └── more/             # 公告/帮助/反馈
│   └── shared/               # 共享组件
│       ├── widgets/          # 通用组件
│       └── utils/            # 工具类
```

## 🚀 开发进度（当前）

### ✅ 已完成（第1步）
- [x] 创建Flutter项目 `wenyu_mobile`
- [x] 添加基础依赖
- [x] 创建登录页静态UI
- [x] 配置基本路由

### ⏳ 进行中
- [ ] 登录页交互逻辑
- [ ] 环境配置（.env）
- [ ] API客户端封装

### 📅 下一步计划
- 实现登录状态持久化
- 搭建个人中心框架（含关于页面）
- 对接健康检查接口验证连接

## 🎨 设计规范

严格遵循Material Design 3设计文档：

- **主色**：`#6750A4`（紫色系）
- **字体**：Google Fonts（Roboto）
- **圆角**：4px/8px/16px/50%
- **间距**：4/8/16/24/32px
- **支持**：亮色/暗色模式、动态配色

## 📦 依赖清单（已添加）

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # UI相关
  google_fonts: ^6.1.0
  flex_color_scheme: ^7.3.1
  material_symbols_icons: ^4.0.0
  
  # 路由
  go_router: ^13.2.0
  
  # 状态管理
  hooks_riverpod: ^2.4.10
  flutter_hooks: ^0.20.5
  
  # 网络
  dio: ^5.4.1
  
  # 本地存储
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  shared_preferences: ^2.2.2
  
  # 工具
  flutter_dotenv: ^5.1.0
  intl: ^0.19.0
  url_launcher: ^6.2.4
```

## 🔧 环境要求

- Flutter SDK: 3.16.0+
- Dart SDK: 3.2.0+
- Android: minSdk 21 (Android 5.0)
- iOS: minSdk 11.0
- Web: 现代浏览器

## 📝 使用说明

### 开发环境配置
```bash
# 1. 克隆项目
git clone [项目地址]

# 2. 安装依赖
flutter pub get

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入API地址

# 4. 运行项目
flutter run
```

### 环境变量示例 (.env)
```
# 主后端API
MAIN_API_BASE_URL=http://[site]:[port]/api

# 移动端API
MOBILE_API_BASE_URL=http://[site]:[port]/mobile-api
MOBILE_API_KEY=dev_mobile_api_key
```

## 🤝 贡献指南

- 遵循极简步进式开发策略
- 每完成一个功能点都要验证
- 保持代码简洁，注释清晰
- 遵循Material Design 3设计规范

## 📄 版本信息

- 当前版本：0.1.0 (开发中)
- 设计语言：Material Design 3
- 目标平台：Android / iOS
