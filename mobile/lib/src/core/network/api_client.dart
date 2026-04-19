import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'dart:io';
import '../constants/app_constants.dart';
import '../constants/env_config.dart';
import 'logging_interceptor.dart';
import 'token_interceptor.dart';

/// API客户端
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  late Dio _mainDio;
  late Dio _mobileDio;

  /// 初始化
  void init() {
    // 主后端API客户端
    _mainDio = Dio(
      BaseOptions(
        baseUrl: EnvConfig.mainApiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
        receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
        sendTimeout: const Duration(milliseconds: AppConstants.sendTimeout),
        headers: {
          'Content-Type': 'application/json',
        },
      ),
    );

    // 移动端API客户端
    _mobileDio = Dio(
      BaseOptions(
        baseUrl: EnvConfig.mobileApiBaseUrl,
        connectTimeout: const Duration(milliseconds: AppConstants.connectTimeout),
        receiveTimeout: const Duration(milliseconds: AppConstants.receiveTimeout),
        sendTimeout: const Duration(milliseconds: AppConstants.sendTimeout),
        headers: {
          'Content-Type': 'application/json',
          'X-Mobile-Api-Key': EnvConfig.mobileApiKey,
        },
      ),
    );

    // 在开发模式下禁用 SSL 证书验证
    // 注意：生产环境中应该移除此配置
    if (EnvConfig.isDevelopment) {
      (_mainDio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final client = HttpClient();
        client.badCertificateCallback = (X509Certificate cert, String host, int port) => true;
        return client;
      };

      (_mobileDio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final client = HttpClient();
        client.badCertificateCallback = (X509Certificate cert, String host, int port) => true;
        return client;
      };
    }

    // 添加拦截器
    _mainDio.interceptors.addAll([
      TokenInterceptor(),
      LoggingInterceptor(),
    ]);

    _mobileDio.interceptors.addAll([
      LoggingInterceptor(),
    ]);
  }

  /// 获取主后端API客户端
  Dio get mainDio => _mainDio;

  /// 获取移动端API客户端
  Dio get mobileDio => _mobileDio;
}
