import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/announcement.dart';
import '../models/todo_stats.dart';
import '../models/recent_visit.dart';
import '../../repository/models/repository.dart';
import '../services/announcement_service.dart';
import '../services/todo_service.dart';
import '../services/recent_visit_service.dart';
import '../../repository/services/repository_service.dart';

/// 首页数据状态
class HomeState {
  final List<Announcement> announcements;
  final List<RecentVisit> recentVisits;
  final List<Repository> repositories;
  final TodoStats? todoStats;
  final bool isLoading;
  final String? error;

  HomeState({
    this.announcements = const [],
    this.recentVisits = const [],
    this.repositories = const [],
    this.todoStats,
    this.isLoading = false,
    this.error,
  });

  HomeState copyWith({
    List<Announcement>? announcements,
    List<RecentVisit>? recentVisits,
    List<Repository>? repositories,
    TodoStats? todoStats,
    bool? isLoading,
    String? error,
  }) {
    return HomeState(
      announcements: announcements ?? this.announcements,
      recentVisits: recentVisits ?? this.recentVisits,
      repositories: repositories ?? this.repositories,
      todoStats: todoStats ?? this.todoStats,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 首页数据 Provider
final homeProvider = StateNotifierProvider<HomeNotifier, HomeState>(
  (ref) => HomeNotifier(),
);

/// 首页数据管理
class HomeNotifier extends StateNotifier<HomeState> {
  final AnnouncementService _announcementService = AnnouncementService();
  final TodoService _todoService = TodoService();
  final RecentVisitService _recentVisitService = RecentVisitService();
  final RepositoryService _repositoryService = RepositoryService();

  HomeNotifier() : super(HomeState());

  /// 加载所有数据
  Future<void> loadAll() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      print('HomeNotifier: 开始加载所有数据');

      // 并行加载所有数据
      final results = await Future.wait([
        _loadAnnouncements(),
        _loadRecentVisits(),
        _loadRepositories(),
        _loadTodoStats(),
      ]);

      print('HomeNotifier: 所有数据加载完成');
      state = state.copyWith(isLoading: false);
    } catch (e) {
      print('HomeNotifier: 加载数据失败: $e');
      state = state.copyWith(
        isLoading: false,
        error: '加载数据失败: $e',
      );
    }
  }

  /// 加载公告
  Future<void> _loadAnnouncements() async {
    try {
      print('HomeNotifier: 加载公告');
      final result = await _announcementService.getAnnouncements(
        page: 1,
        pageSize: 5,
      );
      state = state.copyWith(announcements: result.items);
      print('HomeNotifier: 公告加载完成 - ${result.items.length} 条');
    } catch (e) {
      print('HomeNotifier: 加载公告失败: $e');
      // 不影响其他数据加载
    }
  }

  /// 加载最近访问
  Future<void> _loadRecentVisits() async {
    try {
      print('HomeNotifier: 加载最近访问');
      final visits = await _recentVisitService.getRecentVisits(limit: 5);
      state = state.copyWith(recentVisits: visits);
      print('HomeNotifier: 最近访问加载完成 - ${visits.length} 条');
    } catch (e) {
      print('HomeNotifier: 加载最近访问失败: $e');
    }
  }

  /// 加载仓库列表
  Future<void> _loadRepositories() async {
    try {
      print('HomeNotifier: 加载仓库列表');
      final result = await _repositoryService.getAccessibleRepositories();
      if (result.success && result.data != null) {
        state = state.copyWith(repositories: result.data!);
        print('HomeNotifier: 仓库列表加载完成 - ${result.data!.length} 个');
      } else {
        print('HomeNotifier: 加载仓库失败: ${result.message}');
      }
    } catch (e) {
      print('HomeNotifier: 加载仓库列表失败: $e');
    }
  }

  /// 加载待办统计
  Future<void> _loadTodoStats() async {
    try {
      print('HomeNotifier: 加载待办统计');
      final stats = await _todoService.getTodoStats();
      state = state.copyWith(todoStats: stats);
      print('HomeNotifier: 待办统计加载完成 - 总计: ${stats.total}');
    } catch (e) {
      print('HomeNotifier: 加载待办统计失败: $e');
    }
  }

  /// 刷新所有数据
  Future<void> refresh() async {
    print('HomeNotifier: 刷新所有数据');
    await loadAll();
  }

  /// 添加访问记录
  Future<void> addRecentVisit({
    required String id,
    required String name,
    required String type,
    String? iconName,
    required String repositoryId,
    required String repositoryName,
    required String path,
  }) async {
    await _recentVisitService.addVisit(
      id: id,
      name: name,
      type: type,
      iconName: iconName,
      repositoryId: repositoryId,
      repositoryName: repositoryName,
      path: path,
    );

    // 重新加载最近访问
    await _loadRecentVisits();
  }

  /// 清空最近访问
  Future<void> clearRecentVisits() async {
    await _recentVisitService.clearVisits();
    state = state.copyWith(recentVisits: []);
  }
}
