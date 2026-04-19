import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/login_response.dart';
import '../models/user.dart';

/// 认证服务
class AuthService {
  final Dio _dio = ApiClient().mainDio;

  /// 登录
  Future<ApiResponse<LoginResponse>> login({
    required String username,
    required String password,
  }) async {
    try {
      print('AuthService: 发送登录请求');
      final response = await _dio.post(
        '/auth/login',
        data: {
          'username': username,
          'password': password,
        },
      );

      print('AuthService: 登录响应状态码: ${response.statusCode}');
      print('AuthService: 登录响应完整数据: ${response.data}');
      print('AuthService: data 字段: ${response.data['data']}');

      final result = ApiResponse.fromJson(
        response.data,
        (data) {
          print('AuthService: 开始解析 LoginResponse');
          print('AuthService: data 内容: $data');
          print('AuthService: data 类型: ${data.runtimeType}');
          print('AuthService: data keys: ${data is Map ? data.keys.toList() : "不是 Map"}');

          final loginResponse = LoginResponse.fromJson(data);
          print('AuthService: LoginResponse 解析完成');
          print('AuthService: accessToken: ${loginResponse.accessToken}');
          print('AuthService: refreshToken: ${loginResponse.refreshToken}');
          print('AuthService: user: ${loginResponse.user.name}');

          return loginResponse;
        },
      );

      return result;
    } on DioException catch (e) {
      print('AuthService: DioException - ${e.type}');
      print('AuthService: 错误消息: ${e.message}');
      if (e.response != null) {
        print('AuthService: 错误响应: ${e.response!.data}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '网络错误: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e, stackTrace) {
      print('AuthService: 未知错误: $e');
      print('AuthService: 堆栈跟踪: $stackTrace');
      return ApiResponse(
        success: false,
        message: '登录失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 登出
  Future<ApiResponse<void>> logout() async {
    try {
      final response = await _dio.post('/auth/logout');
      return ApiResponse.fromJson(response.data, null);
    } on DioException catch (e) {
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '网络错误: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  /// 获取当前用户信息
  Future<ApiResponse<User>> getCurrentUser() async {
    try {
      final response = await _dio.get('/auth/me');
      return ApiResponse.fromJson(
        response.data,
        (data) => User.fromJson(data),
      );
    } on DioException catch (e) {
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '网络错误: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  /// 刷新Token
  Future<ApiResponse<LoginResponse>> refreshToken(String refreshToken) async {
    try {
      final response = await _dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      return ApiResponse.fromJson(
        response.data,
        (data) => LoginResponse.fromJson(data),
      );
    } on DioException catch (e) {
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '网络错误: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    }
  }
}
