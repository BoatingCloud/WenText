# 文雨移动端

`mobile/` 是文雨档案管理系统的 Flutter 客户端，用于移动端访问文档管理、主题切换、基础数据读取与扩展业务入口。

## 技术栈

- Flutter 3
- Riverpod + Flutter Hooks
- Dio
- Hive / SharedPreferences
- Go Router

## 当前能力

- 启动时加载 `.env` 配置
- 初始化本地存储
- 初始化 API 客户端
- 使用 Material 3 风格主题与明暗模式
- 通过路由系统组织移动端页面

项目入口见 `mobile/lib/main.dart`。

## 本地启动

```bash
cd mobile
cp .env.example .env
flutter pub get
flutter run
```

## 环境变量

请在 `mobile/.env` 中配置移动端调用的服务地址与相关参数，示例可参考 `.env.example`。

## 目录说明

```text
mobile/
├── lib/
│   └── main.dart
├── android/
├── ios/
├── macos/
├── linux/
├── windows/
├── web/
└── test/
```

## 相关文档

- [移动端接口参考](./api-reference.md)
- [移动端补充说明](./read.md)
