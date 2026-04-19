import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/archive_item.dart';

/// 档案服务
class ArchiveService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取档案列表
  ///
  /// [page] 页码
  /// [pageSize] 每页数量
  /// [search] 搜索关键词（可选）
  /// [categoryId] 分类ID（可选）
  /// [status] 状态（可选）
  /// [workflowStatus] 工作流状态（可选）
  /// [year] 年度（可选）
  /// [includeDestroyed] 是否包含已销毁（可选）
  /// [sortBy] 排序字段（可选）
  /// [sortOrder] 排序方向（可选）
  Future<ApiResponse<List<ArchiveItem>>> getArchiveList({
    int page = 1,
    int pageSize = 20,
    String? search,
    String? categoryId,
    String? status,
    String? workflowStatus,
    String? year,
    bool? includeDestroyed,
    String? sortBy,
    String? sortOrder,
  }) async {
    try {
      print('ArchiveService: 获取档案列表 - 页码: $page');

      final response = await _dio.get(
        '/physical-archives',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (search != null) 'search': search,
          if (categoryId != null) 'categoryId': categoryId,
          if (status != null) 'status': status,
          if (workflowStatus != null) 'workflowStatus': workflowStatus,
          if (year != null) 'year': year,
          if (includeDestroyed != null) 'includeDestroyed': includeDestroyed,
          if (sortBy != null) 'sortBy': sortBy,
          if (sortOrder != null) 'sortOrder': sortOrder,
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

        print('ArchiveService: 成功获取 ${items.length} 个档案');

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
          message: '获取档案列表失败',
        );
      }
    } on DioException catch (e) {
      print('ArchiveService: 获取档案列表失败 - ${e.message}');
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '获取档案列表失败: ${e.message}',
      );
    } catch (e) {
      print('ArchiveService: 获取档案列表异常 - $e');
      return ApiResponse(
        success: false,
        message: '获取档案列表失败: $e',
      );
    }
  }

  /// 获取档案详情
  Future<ApiResponse<ArchiveItem>> getArchiveDetail(String archiveId) async {
    try {
      print('ArchiveService: 获取档案详情 - ID: $archiveId');

      final response = await _dio.get('/physical-archives/$archiveId');

      if (response.statusCode == 200) {
        final data = response.data;
        final archive = ArchiveItem.fromJson(data['data']);

        print('ArchiveService: 成功获取档案详情');
        print('ArchiveService: attachments 原始数据 = ${data['data']['attachments']}');

        return ApiResponse(
          success: true,
          data: archive,
          message: data['message'],
        );
      } else {
        return ApiResponse(
          success: false,
          message: '获取档案详情失败',
        );
      }
    } on DioException catch (e) {
      print('ArchiveService: 获取档案详情失败 - ${e.message}');
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '获取档案详情失败: ${e.message}',
      );
    } catch (e) {
      print('ArchiveService: 获取档案详情异常 - $e');
      return ApiResponse(
        success: false,
        message: '获取档案详情失败: $e',
      );
    }
  }

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
      print('ArchiveService: 搜索档案 - 关键词: $query');

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

        print('ArchiveService: 搜索到 ${items.length} 个档案');

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
          message: '搜索档案失败',
        );
      }
    } on DioException catch (e) {
      print('ArchiveService: 搜索档案失败 - ${e.message}');
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '搜索档案失败: ${e.message}',
      );
    } catch (e) {
      print('ArchiveService: 搜索档案异常 - $e');
      return ApiResponse(
        success: false,
        message: '搜索档案失败: $e',
      );
    }
  }

  /// 创建借阅申请（使用统一借阅接口）
  Future<ApiResponse<void>> createBorrowRequest({
    required String archiveId,
    required String borrower,
    DateTime? borrowedAt,
    DateTime? dueAt,
    String? borrowRemark,
  }) async {
    try {
      print('ArchiveService: 创建借阅申请 - 档案ID: $archiveId');

      final response = await _dio.post(
        '/unified-borrow/$archiveId/borrow-unified',
        data: {
          'borrower': borrower,
          if (borrowedAt != null) 'borrowedAt': borrowedAt.toIso8601String(),
          if (dueAt != null) 'dueAt': dueAt.toIso8601String(),
          if (borrowRemark != null) 'remark': borrowRemark,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        print('ArchiveService: 借阅申请创建成功');
        return ApiResponse(
          success: true,
          message: response.data['message'] ?? '借阅申请已提交',
        );
      } else {
        return ApiResponse(
          success: false,
          message: '创建借阅申请失败',
        );
      }
    } on DioException catch (e) {
      print('ArchiveService: 创建借阅申请失败 - ${e.message}');
      return ApiResponse(
        success: false,
        message: e.response?.data['message'] ?? '创建借阅申请失败: ${e.message}',
      );
    } catch (e) {
      print('ArchiveService: 创建借阅申请异常 - $e');
      return ApiResponse(
        success: false,
        message: '创建借阅申请失败: $e',
      );
    }
  }

  /// 获取全宗列表（用于筛选）
  Future<ApiResponse<List<Map<String, String>>>> getFondList() async {
    try {
      final response = await _dio.get('/fonds');

      if (response.statusCode == 200) {
        final data = response.data;
        List<Map<String, String>> fonds = [];

        if (data['data'] != null && data['data'] is List) {
          fonds = (data['data'] as List).map((item) {
            return {
              'id': item['id'].toString(),
              'name': item['name'].toString(),
            };
          }).toList();
        }

        return ApiResponse(
          success: true,
          data: fonds,
        );
      } else {
        return ApiResponse(
          success: false,
          message: '获取全宗列表失败',
        );
      }
    } catch (e) {
      print('ArchiveService: 获取全宗列表失败 - $e');
      return ApiResponse(
        success: false,
        message: '获取全宗列表失败: $e',
      );
    }
  }
}
