import 'package:dio/dio.dart';
import '../storage/storage_service.dart';
import '../constants/app_constants.dart';

/// Token拦截器
class TokenInterceptor extends Interceptor {
  // 使用单例模式获取 StorageService，确保 Hive 已初始化
  StorageService get _storage => StorageService();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    try {
      // 从存储中获取token
      final token = _storage.getFromHive(AppConstants.tokenKey);
      print('TokenInterceptor: 请求 ${options.uri}');
      print('TokenInterceptor: Token 类型: ${token.runtimeType}');
      print('TokenInterceptor: Token 值: ${token != null ? (token.toString().length > 30 ? "${token.toString().substring(0, 30)}..." : token.toString()) : "null"}');
      print('TokenInterceptor: Token 长度: ${token?.toString().length ?? 0}');

      if (token != null && token.toString().trim().isNotEmpty) {
        final tokenStr = token.toString().trim();
        options.headers['Authorization'] = 'Bearer $tokenStr';
        print('TokenInterceptor: 已添加 Authorization header');
      } else {
        print('TokenInterceptor: 警告 - Token 为空或无效！');
        print('TokenInterceptor: Token is null: ${token == null}');
        print('TokenInterceptor: Token is empty: ${token?.toString().isEmpty ?? true}');
      }
    } catch (e) {
      print('TokenInterceptor: 获取 Token 失败: $e');
    }

    super.onRequest(options, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('TokenInterceptor: 请求错误 ${err.response?.statusCode} - ${err.message}');

    // 如果是401错误，清除token
    if (err.response?.statusCode == 401) {
      print('TokenInterceptor: 检测到401错误，清除认证信息');
      try {
        _storage.deleteFromHive(AppConstants.tokenKey);
        _storage.deleteFromHive(AppConstants.userInfoKey);
      } catch (e) {
        print('TokenInterceptor: 清除认证信息失败: $e');
      }
    }
    super.onError(err, handler);
  }
}
