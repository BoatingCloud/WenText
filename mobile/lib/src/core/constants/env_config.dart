import 'package:flutter_dotenv/flutter_dotenv.dart';

/// 环境配置
class EnvConfig {
  EnvConfig._();

  /// 主后端API基础URL
  static String get mainApiBaseUrl =>
      dotenv.env['MAIN_API_BASE_URL'] ?? 'http://localhost:3000/api';

  /// 移动端API基础URL
  static String get mobileApiBaseUrl =>
      dotenv.env['MOBILE_API_BASE_URL'] ?? 'http://localhost:3001/mobile-api';

  /// 移动端API密钥
  static String get mobileApiKey =>
      dotenv.env['MOBILE_API_KEY'] ?? 'dev_mobile_api_key';

  /// 是否为开发环境
  static bool get isDevelopment =>
      dotenv.env['ENVIRONMENT'] != 'production';
}
