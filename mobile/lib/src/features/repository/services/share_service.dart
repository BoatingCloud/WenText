import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/share_link.dart';

/// 分享服务
class ShareService {
  final Dio _dio = ApiClient().mainDio;

  /// 创建分享链接
  Future<ApiResponse<ShareLink>> createShareLink({
    required String fileId,
    String? password,
    DateTime? expiresAt,
    int? maxViews,
  }) async {
    try {
      print('ShareService: 创建分享链接 - 文件: $fileId');

      // 确定分享类型
      String shareType = 'PUBLIC';
      if (password != null && password.isNotEmpty) {
        shareType = 'PASSWORD';
      }

      final response = await _dio.post(
        '/shares/document/$fileId',
        data: {
          'shareType': shareType,
          'permissions': ['view', 'download'],
          if (password != null && password.isNotEmpty) 'password': password,
          if (expiresAt != null) 'expiresAt': expiresAt.toIso8601String(),
          if (maxViews != null) 'maxViews': maxViews,
        },
      );

      print('ShareService: 响应状态码: ${response.statusCode}');
      print('ShareService: 响应数据: ${response.data}');

      final responseData = response.data;
      if (responseData['success'] == true && responseData['data'] != null) {
        final shareLink = ShareLink.fromJson(responseData['data']);

        return ApiResponse(
          success: true,
          data: shareLink,
          message: responseData['message'] ?? '创建分享链接成功',
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '创建分享链接失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('ShareService: DioException - ${e.type}');
      if (e.response != null) {
        print('ShareService: 错误状态码: ${e.response!.statusCode}');
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '创建分享链接失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('ShareService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '创建分享链接失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 获取文件的分享链接列表
  Future<ApiResponse<List<ShareLink>>> getShareLinks({
    required String fileId,
  }) async {
    try {
      print('ShareService: 获取分享链接列表 - 文件: $fileId');

      final response = await _dio.get(
        '/shares',
        queryParameters: {
          'documentId': fileId,
        },
      );

      final responseData = response.data;
      if (responseData['success'] == true && responseData['data'] != null) {
        final list = responseData['data'] as List;
        final shareLinks = list.map((item) => ShareLink.fromJson(item)).toList();

        return ApiResponse(
          success: true,
          data: shareLinks,
          message: '获取分享链接成功',
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '获取分享链接失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('ShareService: DioException - ${e.type}');
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '获取分享链接失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('ShareService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '获取分享链接失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }

  /// 删除分享链接
  Future<ApiResponse<void>> deleteShareLink({
    required String shareId,
  }) async {
    try {
      print('ShareService: 删除分享链接 - ID: $shareId');

      final response = await _dio.delete(
        '/shares/$shareId',
      );

      final responseData = response.data;
      if (responseData['success'] == true) {
        return ApiResponse(
          success: true,
          message: responseData['message'] ?? '删除分享链接成功',
        );
      } else {
        return ApiResponse(
          success: false,
          message: responseData['message'] ?? '删除分享链接失败',
          code: responseData['code'],
        );
      }
    } on DioException catch (e) {
      print('ShareService: DioException - ${e.type}');
      if (e.response != null) {
        return ApiResponse.fromJson(e.response!.data, null);
      }
      return ApiResponse(
        success: false,
        message: '删除分享链接失败: ${e.message}',
        code: 'NETWORK_ERROR',
      );
    } catch (e) {
      print('ShareService: 未知错误: $e');
      return ApiResponse(
        success: false,
        message: '删除分享链接失败: $e',
        code: 'UNKNOWN_ERROR',
      );
    }
  }
}
