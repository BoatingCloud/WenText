import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../models/todo_stats.dart';

/// 待办服务
class TodoService {
  final Dio _dio = ApiClient().mainDio;

  /// 获取待办统计
  Future<TodoStats> getTodoStats() async {
    try {
      print('TodoService: 正在获取待办统计');

      // 获取待审批数量
      print('TodoService: 获取待审批数量...');
      final approvalResponse = await _dio.get('/approval-todos/unread-count');
      print('TodoService: 待审批响应状态码: ${approvalResponse.statusCode}');
      print('TodoService: 待审批响应数据: ${approvalResponse.data}');
      final approvalCount = approvalResponse.data['data']?['count'] ?? 0;
      print('TodoService: 待审批数量: $approvalCount');

      // 获取待借阅数量（我的待审批借阅申请）
      print('TodoService: 获取待借阅数量...');
      final borrowResponse = await _dio.get(
        '/borrow-requests/my-pending',
        queryParameters: {'page': 1, 'pageSize': 1},
      );
      print('TodoService: 待借阅响应状态码: ${borrowResponse.statusCode}');
      print('TodoService: 待借阅响应数据: ${borrowResponse.data}');
      final borrowCount = borrowResponse.data['pagination']?['total'] ?? 0;
      print('TodoService: 待借阅数量: $borrowCount');

      // 获取待归档数量（状态为 PENDING_REVIEW 的实体档案）
      print('TodoService: 获取待归档数量...');
      final archiveResponse = await _dio.get(
        '/physical-archives',
        queryParameters: {
          'page': 1,
          'pageSize': 1,
          'workflowStatus': 'PENDING_REVIEW',
        },
      );
      print('TodoService: 待归档响应状态码: ${archiveResponse.statusCode}');
      print('TodoService: 待归档响应数据: ${archiveResponse.data}');
      final archiveCount = archiveResponse.data['pagination']?['total'] ?? 0;
      print('TodoService: 待归档数量: $archiveCount');

      final stats = TodoStats(
        pendingApproval: approvalCount,
        pendingArchive: archiveCount,
        pendingBorrow: borrowCount,
      );
      print('TodoService: 成功获取待办统计 - 总计: ${stats.total}');
      return stats;
    } on DioException catch (e) {
      print('TodoService: DioException - ${e.type}');
      print('TodoService: 错误消息: ${e.message}');
      if (e.response != null) {
        print('TodoService: 错误状态码: ${e.response!.statusCode}');
        print('TodoService: 错误响应: ${e.response!.data}');
      }
      // 返回默认值
      return TodoStats(
        pendingApproval: 0,
        pendingArchive: 0,
        pendingBorrow: 0,
      );
    } catch (e, stackTrace) {
      print('TodoService: 未知错误: $e');
      print('TodoService: 堆栈跟踪: $stackTrace');
      return TodoStats(
        pendingApproval: 0,
        pendingArchive: 0,
        pendingBorrow: 0,
      );
    }
  }
}
