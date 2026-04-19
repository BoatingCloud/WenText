/// 应用常量配置
class AppConstants {
  AppConstants._();

  /// 应用名称
  static const String appName = '文雨文档管理系统';

  /// 应用版本
  static const String appVersion = '0.1.0';

  /// 应用构建号
  static const String appBuildNumber = '1';

  /// Token存储键
  static const String tokenKey = 'auth_token';

  /// 用户信息存储键
  static const String userInfoKey = 'user_info';

  /// 主题模式存储键
  static const String themeModeKey = 'theme_mode';

  /// 记住密码存储键
  static const String rememberPasswordKey = 'remember_password';

  /// 用户名存储键
  static const String usernameKey = 'username';

  /// 密码存储键
  static const String passwordKey = 'password';

  /// Token过期时间（毫秒）
  static const int tokenExpireTime = 7 * 24 * 60 * 60 * 1000; // 7天

  /// 请求超时时间（毫秒）
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
  static const int sendTimeout = 30000;
}
