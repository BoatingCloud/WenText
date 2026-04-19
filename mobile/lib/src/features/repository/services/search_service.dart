import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/file_item.dart';

/// 搜索服务
class SearchService {
  final Dio _dio = ApiClient().mainDio;

  /// 搜索文档
  ///
  /// [repositoryId] 仓库ID
  /// [query] 搜索关键词
  /// [page] 页码
  /// [pageSize] 每页数量
  /// [fileType] 文件类型筛选（可选）
  Future<ApiResponse<List<FileItem>>> searchDocuments({
    required String repositoryId,
    required String query,
    int page = 1,
    int pageSize = 20,
    String? fileType,
  }) async {
    try {
      print('SearchService: 搜索文档 - 仓库: $repositoryId, 关键词: $query, 页码: $page');

      final response = await _dio.get(
        '/repositories/$repositoryId/search',
        queryParameters: {
          'q': query,
          'page': page,
          'pageSize': pageSize,
          if (fileType != null) 'fileType': fileType,
        },
      );

      print('SearchService: 搜索响应 - ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = response.data;

        // 解析文件列表
        List<FileItem> items = [];
        if (data['data'] != null) {
          if (data['data'] is List) {
            items = (data['data'] as List)
                .map((item) => FileItem.fromJson(item))
                .toList();
          } else if (data['data']['items'] != null) {
            items = (data['data']['items'] as List)
                .map((item) => FileItem.fromJson(item))
                .toList();
          }
        }

        print('SearchService: 搜索成功 - 找到 ${items.length} 个结果');

        return ApiResponse(
          success: true,
          data: items,
          message: data['message'],
          pagination: data['pagination'] != null
              ? PaginationInfo.fromJson(data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(
          success: false,
          message: '搜索失败: ${response.statusMessage}',
        );
      }
    } on DioException catch (e) {
      print('SearchService: 搜索失败 - ${e.message}');
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '搜索失败: ${e.message}',
      );
    } catch (e) {
      print('SearchService: 搜索异常 - $e');
      return ApiResponse(
        success: false,
        message: '搜索失败: $e',
      );
    }
  }

  /// 获取搜索建议
  ///
  /// [repositoryId] 仓库ID
  /// [query] 搜索关键词
  Future<ApiResponse<List<String>>> getSearchSuggestions({
    required String repositoryId,
    required String query,
  }) async {
    try {
      print('SearchService: 获取搜索建议 - 仓库: $repositoryId, 关键词: $query');

      final response = await _dio.get(
        '/repositories/$repositoryId/search/suggestions',
        queryParameters: {
          'q': query,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        List<String> suggestions = [];

        if (data['data'] != null && data['data'] is List) {
          suggestions = (data['data'] as List)
              .map((item) => item.toString())
              .toList();
        }

        return ApiResponse(
          success: true,
          data: suggestions,
        );
      } else {
        return ApiResponse(
          success: false,
          message: '获取搜索建议失败',
        );
      }
    } catch (e) {
      print('SearchService: 获取搜索建议失败 - $e');
      return ApiResponse(
        success: false,
        message: '获取搜索建议失败: $e',
      );
    }
  }
}
