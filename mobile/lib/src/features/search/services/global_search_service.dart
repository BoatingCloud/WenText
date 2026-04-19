import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../../archive/models/archive_item.dart';

/// 全局搜索服务
class GlobalSearchService {
  final Dio _dio = ApiClient().mainDio;

  /// 搜索档案
  Future<ApiResponse<List<ArchiveItem>>> searchArchives({
    required String query,
    int page = 1,
    int pageSize = 20,
    String? categoryId,
    String? status,
    String? year,
  }) async {
    try {
      final response = await _dio.get(
        '/physical-archives',
        queryParameters: {
          'search': query,
          'page': page,
          'pageSize': pageSize,
          if (categoryId != null) 'categoryId': categoryId,
          if (status != null) 'status': status,
          if (year != null) 'year': year,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        List<ArchiveItem> items = [];

        if (data['data'] != null) {
          if (data['data'] is List) {
            items = (data['data'] as List)
                .map((item) => ArchiveItem.fromJson(item))
                .toList();
          } else if (data['data']['items'] != null) {
            items = (data['data']['items'] as List)
                .map((item) => ArchiveItem.fromJson(item))
                .toList();
          }
        }

        return ApiResponse(
          success: true,
          data: items,
          pagination: data['pagination'] != null
              ? PaginationInfo.fromJson(data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(success: false, message: '搜索失败');
      }
    } on DioException catch (e) {
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '搜索失败: ${e.message}',
      );
    } catch (e) {
      return ApiResponse(success: false, message: '搜索失败: $e');
    }
  }
}
