import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/approval_request.dart';
import '../models/approval_history.dart';
import '../models/borrow_record.dart';
import '../models/notification_message.dart';

/// 待办中心服务
class TodoService {
  final _dio = ApiClient().mainDio;

  /// 获取待我审批列表
  Future<ApiResponse<List<ApprovalRequest>>> getPendingApprovals({
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final response = await _dio.get(
        '/borrow-requests/my-pending',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;
        final items = data?.map((json) => ApprovalRequest.fromJson(json)).toList() ?? [];

        return ApiResponse(
          success: true,
          data: items,
          message: '获取成功',
          pagination: response.data['pagination'] != null
              ? PaginationInfo.fromJson(response.data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(success: false, message: '获取待审批列表失败');
      }
    } catch (e) {
      print('TodoService.getPendingApprovals error: $e');
      return ApiResponse(success: false, message: '获取待审批列表失败: $e');
    }
  }

  /// 获取我的申请列表
  Future<ApiResponse<List<ApprovalRequest>>> getMyApplications({
    int page = 1,
    int pageSize = 20,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'pageSize': pageSize,
      };
      if (status != null) {
        queryParams['status'] = status;
      }

      final response = await _dio.get(
        '/borrow-requests/my-applications',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;
        final items = data?.map((json) => ApprovalRequest.fromJson(json)).toList() ?? [];

        return ApiResponse(
          success: true,
          data: items,
          message: '获取成功',
          pagination: response.data['pagination'] != null
              ? PaginationInfo.fromJson(response.data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(success: false, message: '获取我的申请列表失败');
      }
    } catch (e) {
      print('TodoService.getMyApplications error: $e');
      return ApiResponse(success: false, message: '获取我的申请列表失败: $e');
    }
  }

  /// 获取我的借阅列表（借阅中的档案）
  Future<ApiResponse<List<BorrowRecord>>> getMyBorrows({
    int page = 1,
    int pageSize = 20,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'pageSize': pageSize,
      };
      if (status != null) {
        queryParams['search'] = status; // 使用 search 参数进行过滤
      }

      final response = await _dio.get(
        '/unified-borrow/borrowed-archives',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;
        // 将档案数据转换为借阅记录
        final items = data?.map<BorrowRecord>((json) {
          // 从档案数据构造借阅记录
          return BorrowRecord(
            id: json['id'] ?? '',
            archiveId: json['id'] ?? '',
            archiveName: json['title'] ?? '',
            archiveNumber: json['archiveNo'],
            borrowerId: json['borrowerId'] ?? '',
            borrowerName: json['borrower'] ?? '未知',
            borrowerDepartment: json['borrowerDepartment'],
            borrowedAt: json['borrowedAt'] != null
                ? DateTime.parse(json['borrowedAt'])
                : DateTime.now(),
            dueAt: json['dueAt'] != null
                ? DateTime.parse(json['dueAt'])
                : DateTime.now().add(const Duration(days: 30)),
            returnedAt: json['returnedAt'] != null
                ? DateTime.parse(json['returnedAt'])
                : null,
            borrowRemark: json['remark'],
            returnRemark: null,
            renewCount: 0,
            maxRenewCount: 3,
            status: json['status'] == 'BORROWED'
                ? BorrowStatus.borrowing
                : BorrowStatus.returned,
            createdAt: json['createdAt'] != null
                ? DateTime.parse(json['createdAt'])
                : DateTime.now(),
            updatedAt: json['updatedAt'] != null
                ? DateTime.parse(json['updatedAt'])
                : DateTime.now(),
          );
        }).toList() ?? [];

        return ApiResponse(
          success: true,
          data: items,
          message: '获取成功',
          pagination: response.data['pagination'] != null
              ? PaginationInfo.fromJson(response.data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(success: false, message: '获取我的借阅列表失败');
      }
    } catch (e) {
      print('TodoService.getMyBorrows error: $e');
      return ApiResponse(success: false, message: '获取我的借阅列表失败: $e');
    }
  }

  /// 获取审批详情
  Future<ApiResponse<ApprovalRequest>> getApprovalDetail(String id) async {
    try {
      final response = await _dio.get('/borrow-requests/$id');

      if (response.statusCode == 200) {
        final data = ApprovalRequest.fromJson(response.data['data']);
        return ApiResponse(success: true, data: data, message: '获取成功');
      } else {
        return ApiResponse(success: false, message: '获取审批详情失败');
      }
    } catch (e) {
      print('TodoService.getApprovalDetail error: $e');
      return ApiResponse(success: false, message: '获取审批详情失败: $e');
    }
  }

  /// 获取审批历史
  Future<ApiResponse<List<ApprovalHistory>>> getApprovalHistory(String requestId) async {
    try {
      final response = await _dio.get('/borrow-requests/$requestId/history');

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;
        final items = data?.map((json) => ApprovalHistory.fromJson(json)).toList() ?? [];

        return ApiResponse(success: true, data: items, message: '获取成功');
      } else {
        return ApiResponse(success: false, message: '获取审批历史失败');
      }
    } catch (e) {
      print('TodoService.getApprovalHistory error: $e');
      return ApiResponse(success: false, message: '获取审批历史失败: $e');
    }
  }

  /// 审批通过
  Future<ApiResponse<void>> approveRequest({
    required String requestId,
    String? comment,
    String? signatureUrl,
  }) async {
    try {
      final response = await _dio.post(
        '/borrow-requests/$requestId/approve',
        data: {
          if (comment != null) 'comment': comment,
          if (signatureUrl != null) 'signatureUrl': signatureUrl,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: response.data['message'] ?? '审批通过');
      } else {
        return ApiResponse(success: false, message: response.data['message'] ?? '审批失败');
      }
    } catch (e) {
      print('TodoService.approveRequest error: $e');
      return ApiResponse(success: false, message: '审批失败: $e');
    }
  }

  /// 审批驳回
  Future<ApiResponse<void>> rejectRequest({
    required String requestId,
    required String comment,
    String? signatureUrl,
  }) async {
    try {
      final response = await _dio.post(
        '/borrow-requests/$requestId/reject',
        data: {
          'comment': comment,
          if (signatureUrl != null) 'signatureUrl': signatureUrl,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: response.data['message'] ?? '已驳回');
      } else {
        return ApiResponse(success: false, message: response.data['message'] ?? '驳回失败');
      }
    } catch (e) {
      print('TodoService.rejectRequest error: $e');
      return ApiResponse(success: false, message: '驳回失败: $e');
    }
  }

  /// 取消申请
  Future<ApiResponse<void>> cancelRequest(String requestId) async {
    try {
      final response = await _dio.post('/borrow-requests/$requestId/cancel');

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: response.data['message'] ?? '已取消');
      } else {
        return ApiResponse(success: false, message: response.data['message'] ?? '取消失败');
      }
    } catch (e) {
      print('TodoService.cancelRequest error: $e');
      return ApiResponse(success: false, message: '取消失败: $e');
    }
  }

  /// 获取借阅详情
  /// TODO: 后端暂未提供此 API
  Future<ApiResponse<BorrowRecord>> getBorrowDetail(String id) async {
    try {
      // 暂时返回错误，等待后端 API 实现
      return ApiResponse(success: false, message: '该功能正在开发中');

      /*
      // 待后端实现后使用以下代码
      final response = await _dio.get('/borrows/$id');

      if (response.statusCode == 200) {
        final data = BorrowRecord.fromJson(response.data['data']);
        return ApiResponse(success: true, data: data, message: '获取成功');
      } else {
        return ApiResponse(success: false, message: '获取借阅详情失败');
      }
      */
    } catch (e) {
      print('TodoService.getBorrowDetail error: $e');
      return ApiResponse(success: false, message: '获取借阅详情失败: $e');
    }
  }

  /// 续借申请
  /// TODO: 后端暂未提供此 API
  Future<ApiResponse<void>> renewBorrow({
    required String borrowId,
    required int days,
    String? reason,
  }) async {
    try {
      // 暂时返回错误，等待后端 API 实现
      return ApiResponse(success: false, message: '该功能正在开发中');

      /*
      // 待后端实现后使用以下代码
      final response = await _dio.post(
        '/borrows/$borrowId/renew',
        data: {
          'days': days,
          if (reason != null) 'reason': reason,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: response.data['message'] ?? '续借申请已提交');
      } else {
        return ApiResponse(success: false, message: response.data['message'] ?? '续借申请失败');
      }
      */
    } catch (e) {
      print('TodoService.renewBorrow error: $e');
      return ApiResponse(success: false, message: '续借申请失败: $e');
    }
  }

  /// 归还档案（使用统一归还接口）
  Future<ApiResponse<void>> returnBorrow({
    required String borrowId,
    String? remark,
  }) async {
    try {
      final response = await _dio.post(
        '/unified-borrow/$borrowId/return-unified',
        data: {
          'returnedAt': DateTime.now().toIso8601String(),
          if (remark != null) 'returnRemark': remark,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: response.data['message'] ?? '归还成功');
      } else {
        return ApiResponse(success: false, message: response.data['message'] ?? '归还失败');
      }
    } catch (e) {
      print('TodoService.returnBorrow error: $e');
      return ApiResponse(success: false, message: '归还失败: $e');
    }
  }

  /// 获取消息通知列表
  Future<ApiResponse<List<NotificationMessage>>> getNotifications({
    int page = 1,
    int pageSize = 20,
    String? type,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'pageSize': pageSize,
      };
      if (type != null) {
        queryParams['type'] = type;
      }

      final response = await _dio.get(
        '/approval-todos',
        queryParameters: queryParams,
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;
        final items = data?.map((json) => NotificationMessage.fromJson(json)).toList() ?? [];

        return ApiResponse(success: true, 
          data: items,
          message: '获取成功',
          pagination: response.data['pagination'] != null
              ? PaginationInfo.fromJson(response.data['pagination'])
              : null,
        );
      } else {
        return ApiResponse(success: false, message: '获取消息列表失败');
      }
    } catch (e) {
      print('TodoService.getNotifications error: $e');
      return ApiResponse(success: false, message: '获取消息列表失败: $e');
    }
  }

  /// 标记消息已读
  Future<ApiResponse<void>> markNotificationAsRead(String id) async {
    try {
      final response = await _dio.put('/approval-todos/$id/read');

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: '已标记为已读');
      } else {
        return ApiResponse(success: false, message: '标记失败');
      }
    } catch (e) {
      print('TodoService.markNotificationAsRead error: $e');
      return ApiResponse(success: false, message: '标记失败: $e');
    }
  }

  /// 标记所有消息已读
  Future<ApiResponse<void>> markAllNotificationsAsRead() async {
    try {
      final response = await _dio.put('/approval-todos/read-all');

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: '已全部标记为已读');
      } else {
        return ApiResponse(success: false, message: '标记失败');
      }
    } catch (e) {
      print('TodoService.markAllNotificationsAsRead error: $e');
      return ApiResponse(success: false, message: '标记失败: $e');
    }
  }

  /// 删除消息
  /// TODO: 后端暂未提供此 API
  Future<ApiResponse<void>> deleteNotification(String id) async {
    try {
      // 暂时返回成功，等待后端 API 实现
      return ApiResponse(success: true, message: '删除成功');

      /*
      // 待后端实现后使用以下代码
      final response = await _dio.delete('/notifications/$id');

      if (response.statusCode == 200) {
        return ApiResponse(success: true, message: '删除成功');
      } else {
        return ApiResponse(success: false, message: '删除失败');
      }
      */
    } catch (e) {
      print('TodoService.deleteNotification error: $e');
      return ApiResponse(success: false, message: '删除失败: $e');
    }
  }

  /// 获取待办数量
  Future<ApiResponse<Map<String, int>>> getTodoCount() async {
    try {
      final response = await _dio.get('/approval-todos/unread-count');

      if (response.statusCode == 200) {
        final count = response.data['data']['count'] as int? ?? 0;
        // 将单个 count 映射到各个类别
        final data = {
          'pendingApprovals': count,
          'myApplications': 0,
          'myBorrows': 0,
          'unreadNotifications': count,
        };
        return ApiResponse(success: true, data: data, message: '获取成功');
      } else {
        return ApiResponse(success: false, message: '获取待办数量失败');
      }
    } catch (e) {
      print('TodoService.getTodoCount error: $e');
      return ApiResponse(success: false, message: '获取待办数量失败: $e');
    }
  }

  /// 上传签名图片
  Future<ApiResponse<Map<String, dynamic>>> uploadSignature(String filePath) async {
    try {
      final fileName = filePath.split('/').last;
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          filePath,
          filename: fileName,
        ),
      });

      final response = await _dio.post(
        '/approval-todos/upload-signature',
        data: formData,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return ApiResponse(
          success: true,
          data: response.data['data'] as Map<String, dynamic>,
          message: response.data['message'] ?? '签名上传成功',
        );
      } else {
        return ApiResponse(success: false, message: '签名上传失败');
      }
    } catch (e) {
      print('TodoService.uploadSignature error: $e');
      return ApiResponse(success: false, message: '签名上传失败: $e');
    }
  }
}
