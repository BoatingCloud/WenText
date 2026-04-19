import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/document.dart';

/// 文档服务
class DocumentService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取最近访问的文档（使用第一个可访问仓库的文档列表）
  Future<List<Document>> getRecentDocuments({
    required String repositoryId,
    int limit = 5,
  }) async {
    try {
      print('DocumentService: 正在获取最近文档');
      print('DocumentService: repositoryId=$repositoryId, limit=$limit');

      final response = await _dio.get(
        '/documents/repo/$repositoryId',
        queryParameters: {
          'path': '/',
          'page': 1,
          'pageSize': limit,
        },
      );

      print('DocumentService: 响应状态码: ${response.statusCode}');
      print('DocumentService: 响应数据: ${response.data}');

      final result = ApiResponse.fromJson(
        response.data,
        (data) {
          final list = data as List;
          print('DocumentService: 解析到 ${list.length} 个文档');
          return list.map((item) => Document.fromJson(item)).toList();
        },
      );

      if (result.success && result.data != null) {
        // 只返回文件，不返回文件夹
        final files = result.data!.where((doc) => doc.type == 'file').toList();
        print('DocumentService: 过滤后剩余 ${files.length} 个文件');
        return files;
      }

      print('DocumentService: API 返回失败或无数据');
      return [];
    } on DioException catch (e) {
      print('DocumentService: DioException - ${e.type}');
      print('DocumentService: 错误消息: ${e.message}');
      if (e.response != null) {
        print('DocumentService: 错误状态码: ${e.response!.statusCode}');
        print('DocumentService: 错误响应: ${e.response!.data}');
      }
      return [];
    } catch (e, stackTrace) {
      print('DocumentService: 未知错误: $e');
      print('DocumentService: 堆栈跟踪: $stackTrace');
      return [];
    }
  }
}
