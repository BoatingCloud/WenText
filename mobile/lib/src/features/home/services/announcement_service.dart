import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../models/announcement.dart';

/// 公告服务响应
class AnnouncementListResponse {
  final List<Announcement> items;
  final int page;
  final int pageSize;
  final int total;

  AnnouncementListResponse({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory AnnouncementListResponse.fromJson(Map<String, dynamic> json) {
    return AnnouncementListResponse(
      items: (json['items'] as List).map((item) => Announcement.fromJson(item)).toList(),
      page: json['page'] ?? 1,
      pageSize: json['pageSize'] ?? 20,
      total: json['total'] ?? 0,
    );
  }
}

/// 公告服务
class AnnouncementService {
  final Dio _dio = ApiClient().mobileDio;

  /// 获取公告列表
  Future<AnnouncementListResponse> getAnnouncements({
    int page = 1,
    int pageSize = 10,
  }) async {
    try {
      print('AnnouncementService: 正在获取公告列表');
      print('AnnouncementService: page=$page, pageSize=$pageSize');

      final response = await _dio.get(
        '/announcements',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
        },
      );

      print('AnnouncementService: 响应状态码: ${response.statusCode}');
      print('AnnouncementService: 响应数据: ${response.data}');

      final result = AnnouncementListResponse.fromJson(response.data);
      print('AnnouncementService: 成功获取 ${result.items.length} 条公告');
      return result;
    } on DioException catch (e) {
      print('AnnouncementService: DioException - ${e.type}');
      print('AnnouncementService: 错误消息: ${e.message}');
      if (e.response != null) {
        print('AnnouncementService: 错误状态码: ${e.response!.statusCode}');
        print('AnnouncementService: 错误响应: ${e.response!.data}');
      }
      throw Exception('获取公告失败: ${e.message}');
    } catch (e, stackTrace) {
      print('AnnouncementService: 未知错误: $e');
      print('AnnouncementService: 堆栈跟踪: $stackTrace');
      throw Exception('获取公告失败: $e');
    }
  }
}
