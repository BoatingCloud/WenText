import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/file_item.dart';

/// 文件浏览服务
class FileBrowserService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取目录内容
  Future<ApiResponse<List<FileItem>>> getDirectoryContents({
    required String repositoryId,
    String path = '',
    int page = 1,
    int pageSize = 50,
  }) async {
    try {
      print('FileBrowserService: 获取目录内容 - 仓库: $repositoryId, 路径: $path, 页码: $page');

      final response = await _dio.get(
        '/documents/repo/$repositoryId',
        queryParameters: {
          'path': path.isEmpty ? '/' : path,
          'page': page,
          'pageSize': pageSize,
        },
      );

      print('FileBrowserService: 响应状态码: ${response.statusCode}');
      print('FileBrowserService: 响应数据: ${response.data}');

      // API 返回格式: { success, data: [...], pagination: {...} }
      final responseData = response.data;
      if (responseData['success'] == true && responseData['data'] != null) {
        final list = responseData['data'] as List;
        print('FileBrowserService: 解析到 ${list.length} 个项目');
        final items = list.map((item) => FileItem.fromJson(item)).toList();

        // 解析分页信息
        PaginationInfo? paginationInfo;
        if (responseData['pagination'] != null) {
          paginationInfo = PaginationInfo.fromJson(responseData['pagination']);
        }

        return ApiResponse(
          success: true,
          data: items,
          message: '获取目录内容成功',
          pagination: paginationInfo,
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '获取目录内容失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('FileBrowserService: DioException - ${e.type}');
      if (e.response != null) {
        print('FileBrowserService: 错误状态码: ${e.response!.statusCode}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取目录内容失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('FileBrowserService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取目录内容失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 获取文件详情
  Future<ApiResponse<FileItem>> getFileDetails({
    required String repositoryId,
    required String fileId,
  }) async {
    try {
      print('FileBrowserService: 获取文件详情 - 仓库: $repositoryId, 文件: $fileId');

      final response = await _dio.get(
        '/documents/$fileId',
      );

      final result = ApiResponse.fromJson(
        response.data,
        (data) => FileItem.fromJson(data),
      );

      return result;
    } on DioException catch (e) {
      print('FileBrowserService: DioException - ${e.type}');
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取文件详情失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('FileBrowserService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取文件详情失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 获取文件下载URL
  Future<ApiResponse<String>> getFileDownloadUrl({
    required String repositoryId,
    required String fileId,
  }) async {
    try {
      print('FileBrowserService: 获取文件下载URL - 仓库: $repositoryId, 文件: $fileId');

      // 直接返回下载 URL,不需要额外请求
      final downloadUrl = '/documents/$fileId/download';

      return ApiResponse(
        success: true,
        data: downloadUrl,
        message: '获取下载URL成功',
      );
    } on DioException catch (e) {
      print('FileBrowserService: DioException - ${e.type}');
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取下载URL失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('FileBrowserService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取下载URL失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }
}
