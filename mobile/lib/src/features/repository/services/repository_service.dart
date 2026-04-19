import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/repository.dart';

/// 仓库服务
class RepositoryService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取当前用户可访问的仓库列表
  Future<ApiResponse<List<Repository>>> getAccessibleRepositories() async {
    try {
      print('RepositoryService: 正在获取可访问仓库列表');
      final response = await _dio.get('/repositories/accessible');
      print('RepositoryService: 响应状态码: ${response.statusCode}');
      print('RepositoryService: 响应数据: ${response.data}');

      final result = ApiResponse.fromJson(
        response.data,
        (data) {
          final list = data as List;
          print('RepositoryService: 解析到 ${list.length} 个仓库');
          return list.map((item) => Repository.fromJson(item)).toList();
        },
      );

      print('RepositoryService: 成功获取仓库列表');
      return result;
    } on DioException catch (e) {
      print('RepositoryService: DioException - ${e.type}');
      print('RepositoryService: 错误消息: ${e.message}');
      if (e.response != null) {
        print('RepositoryService: 错误状态码: ${e.response!.statusCode}');
        print('RepositoryService: 错误响应: ${e.response!.data}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取仓库列表失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e, stackTrace) {
      print('RepositoryService: 未知错误: $e');
      print('RepositoryService: 堆栈跟踪: $stackTrace');
      return ApiResponse(
        success: false,
        message: '获取仓库列表失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }
}
