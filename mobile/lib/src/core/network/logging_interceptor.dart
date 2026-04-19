import 'package:dio/dio.dart';
import 'dart:developer' as developer;

/// 日志拦截器
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    developer.log(
      '请求: ${options.method} ${options.uri}',
      name: 'HTTP',
    );
    if (options.data != null) {
      developer.log(
        '请求数据: ${options.data}',
        name: 'HTTP',
      );
    }
    super.onRequest(options, handler);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    developer.log(
      '响应: ${response.statusCode} ${response.requestOptions.uri}',
      name: 'HTTP',
    );
    developer.log(
      '响应数据: ${response.data}',
      name: 'HTTP',
    );
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    developer.log(
      '错误: ${err.type} ${err.requestOptions.uri}',
      name: 'HTTP',
      error: err,
    );
    if (err.response != null) {
      developer.log(
        '错误响应: ${err.response?.data}',
        name: 'HTTP',
      );
    }
    super.onError(err, handler);
  }
}
