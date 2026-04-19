import 'dart:convert';
import '../../../core/storage/storage_service.dart';
import '../models/recent_visit.dart';

/// 最近访问服务
class RecentVisitService {
  static final RecentVisitService _instance = RecentVisitService._internal();
  factory RecentVisitService() => _instance;
  RecentVisitService._internal();

  final StorageService _storage = StorageService();
  static const String _recentVisitsKey = 'recent_visits';
  static const int _maxRecords = 20;

  /// 添加访问记录
  Future<void> addVisit({
    required String id,
    required String name,
    required String type,
    String? iconName,
    required String repositoryId,
    required String repositoryName,
    required String path,
  }) async {
    try {
      final visits = await getRecentVisits();

      // 移除相同 id 的旧记录
      visits.removeWhere((v) => v.id == id);

      // 添加新记录到开头
      visits.insert(
        0,
        RecentVisit(
          id: id,
          name: name,
          type: type,
          iconName: iconName,
          repositoryId: repositoryId,
          repositoryName: repositoryName,
          path: path,
          visitedAt: DateTime.now(),
        ),
      );

      // 保持最多 _maxRecords 条记录
      if (visits.length > _maxRecords) {
        visits.removeRange(_maxRecords, visits.length);
      }

      // 保存到本地
      await _saveVisits(visits);
      print('RecentVisitService: 已添加访问记录 - $name');
    } catch (e) {
      print('RecentVisitService: 添加访问记录失败: $e');
    }
  }

  /// 获取最近访问列表
  Future<List<RecentVisit>> getRecentVisits({int? limit}) async {
    try {
      final jsonStr = _storage.getFromHive(_recentVisitsKey);
      if (jsonStr == null) return [];

      final List<dynamic> jsonList = jsonDecode(jsonStr);
      final visits = jsonList.map((json) => RecentVisit.fromJson(json)).toList();

      if (limit != null && visits.length > limit) {
        return visits.sublist(0, limit);
      }

      return visits;
    } catch (e) {
      print('RecentVisitService: 获取访问记录失败: $e');
      return [];
    }
  }

  /// 清空访问记录
  Future<void> clearVisits() async {
    try {
      await _storage.deleteFromHive(_recentVisitsKey);
      print('RecentVisitService: 已清空访问记录');
    } catch (e) {
      print('RecentVisitService: 清空访问记录失败: $e');
    }
  }

  /// 删除指定记录
  Future<void> removeVisit(String id) async {
    try {
      final visits = await getRecentVisits();
      visits.removeWhere((v) => v.id == id);
      await _saveVisits(visits);
      print('RecentVisitService: 已删除访问记录 - $id');
    } catch (e) {
      print('RecentVisitService: 删除访问记录失败: $e');
    }
  }

  /// 保存访问记录
  Future<void> _saveVisits(List<RecentVisit> visits) async {
    final jsonList = visits.map((v) => v.toJson()).toList();
    final jsonStr = jsonEncode(jsonList);
    await _storage.saveToHive(_recentVisitsKey, jsonStr);
  }
}
