import 'package:dio/dio.dart';
import '../network/api_client.dart';
import '../network/api_response.dart';
import '../constants/env_config.dart';

/// 健康检查服务
class HealthCheckService {
  final Dio _mainDio = ApiClient().mainDio;
  final Dio _mobileDio = ApiClient().mobileDio;

  /// 检查主API健康状态
  Future<ApiResponse<Map<String, dynamic>>> checkMainApiHealth() async {
    try {
      print('正在检查主API: ${EnvConfig.mainApiBaseUrl}/health');
      final response = await _mainDio.get('/health');
      print('主API响应: ${response.statusCode}');
      return ApiResponse.fromJson(response.data, (data) => data as Map<String, dynamic>);
    } on DioException catch (e) {
      print('主API错误: ${e.type} - ${e.message}');
      if (e.response != null) {
        print('响应数据: ${e.response!.data}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '主API连接失败: ${_getDioErrorMessage(e)}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('主API未知错误: $e');
      return ApiResponse(
        success: false,
        message: '主API连接失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 检查移动API健康状态
  Future<ApiResponse<Map<String, dynamic>>> checkMobileApiHealth() async {
    try {
      print('正在检查移动API: ${EnvConfig.mobileApiBaseUrl}/health');
      final response = await _mobileDio.get('/health');
      print('移动API响应: ${response.statusCode}');
      return ApiResponse.fromJson(response.data, (data) => data as Map<String, dynamic>);
    } on DioException catch (e) {
      print('移动API错误: ${e.type} - ${e.message}');
      if (e.response != null) {
        print('响应数据: ${e.response!.data}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '移动API连接失败: ${_getDioErrorMessage(e)}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('移动API未知错误: $e');
      return ApiResponse(
        success: false,
        message: '移动API连接失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 检查所有API健康状态
  Future<Map<String, dynamic>> checkAllHealth() async {
    final results = await Future.wait([
      checkMainApiHealth(),
      checkMobileApiHealth(),
    ]);

    return {
      'mainApi': results[0].success,
      'mainApiMessage': results[0].message,
      'mobileApi': results[1].success,
      'mobileApiMessage': results[1].message,
    };
  }

  /// 获取友好的错误信息
  String _getDioErrorMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
        return '连接超时';
      case DioExceptionType.sendTimeout:
        return '发送超时';
      case DioExceptionType.receiveTimeout:
        return '接收超时';
      case DioExceptionType.badResponse:
        return '服务器响应错误 (${e.response?.statusCode})';
      case DioExceptionType.cancel:
        return '请求已取消';
      case DioExceptionType.connectionError:
        return '网络连接失败，请检查网络设置';
      case DioExceptionType.badCertificate:
        return 'SSL证书验证失败';
      case DioExceptionType.unknown:
      default:
        return e.message ?? '未知错误';
    }
  }
}
