import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/file_version.dart';

/// 版本历史服务
class VersionService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取文件版本历史
  Future<ApiResponse<List<FileVersion>>> getVersionHistory({
    required String fileId,
  }) async {
    try {
      print('VersionService: 获取版本历史 - 文件: $fileId');

      final response = await _dio.get(
        '/documents/$fileId/versions',
      );

      print('VersionService: 响应状态码: ${response.statusCode}');
      print('VersionService: 响应数据: ${response.data}');

      final responseData = response.data;
      if (responseData['success'] == true && responseData['data'] != null) {
        final list = responseData['data'] as List;
        print('VersionService: 解析到 ${list.length} 个版本');
        final versions = list.map((item) => FileVersion.fromJson(item)).toList();

        return ApiResponse(
          success: true,
          data: versions,
          message: '获取版本历史成功',
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '获取版本历史失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('VersionService: DioException - ${e.type}');
      if (e.response != null) {
        print('VersionService: 错误状态码: ${e.response!.statusCode}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取版本历史失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('VersionService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取版本历史失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 恢复到指定版本
  Future<ApiResponse<void>> restoreVersion({
    required String fileId,
    required String versionId,
  }) async {
    try {
      print('VersionService: 恢复版本 - 文件: $fileId, 版本: $versionId');

      final response = await _dio.post(
        '/documents/$fileId/versions/$versionId/restore',
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return ApiResponse(
          success: true,
          message: responseData['message'] ?? '恢复版本成功',
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '恢复版本失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('VersionService: DioException - ${e.type}');
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '恢复版本失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('VersionService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '恢复版本失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 下载指定版本
  Future<ApiResponse<String>> getVersionDownloadUrl({
    required String fileId,
    required String versionId,
  }) async {
    try {
      print('VersionService: 获取版本下载URL - 文件: $fileId, 版本: $versionId');

      // 直接返回下载 URL
      final downloadUrl = '/documents/$fileId/versions/$versionId/download';

      return ApiResponse(
        success: true,
        data: downloadUrl,
        message: '获取下载URL成功',
      );
    } catch (e) {
      print('VersionService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取下载URL失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }
}
