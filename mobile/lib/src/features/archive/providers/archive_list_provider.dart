import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/archive_item.dart';
import '../services/archive_service.dart';

/// 排序类型
enum ArchiveSortType {
  time,      // 按时间
  name,      // 按名称
  relevance, // 按相关度
}

/// 排序方向
enum SortOrder {
  ascending,   // 升序
  descending,  // 降序
}

/// 档案列表状态
class ArchiveListState {
  final List<ArchiveItem> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int pageSize;
  final bool hasMore;
  final ArchiveSortType sortType;
  final SortOrder sortOrder;

  // 筛选条件
  final String? categoryId;
  final String? year;
  final String? category;
  final String? securityLevel;
  final String? retentionPeriod;
  final String? status;
  final String? searchQuery; // 搜索关键词

  ArchiveListState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.pageSize = 20,
    this.hasMore = true,
    this.sortType = ArchiveSortType.time,
    this.sortOrder = SortOrder.descending,
    this.categoryId,
    this.year,
    this.category,
    this.securityLevel,
    this.retentionPeriod,
    this.status,
    this.searchQuery,
  });

  ArchiveListState copyWith({
    List<ArchiveItem>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? pageSize,
    bool? hasMore,
    ArchiveSortType? sortType,
    SortOrder? sortOrder,
    String? categoryId,
    String? year,
    String? category,
    String? securityLevel,
    String? retentionPeriod,
    String? status,
    String? searchQuery,
  }) {
    return ArchiveListState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
      sortType: sortType ?? this.sortType,
      sortOrder: sortOrder ?? this.sortOrder,
      categoryId: categoryId ?? this.categoryId,
      year: year ?? this.year,
      category: category ?? this.category,
      securityLevel: securityLevel ?? this.securityLevel,
      retentionPeriod: retentionPeriod ?? this.retentionPeriod,
      status: status ?? this.status,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  /// 清除筛选条件
  ArchiveListState clearFilters() {
    return ArchiveListState(
      items: items,
      isLoading: isLoading,
      isLoadingMore: isLoadingMore,
      error: error,
      currentPage: 1,
      pageSize: pageSize,
      hasMore: hasMore,
      sortType: sortType,
      sortOrder: sortOrder,
      // 清除所有筛选条件
      categoryId: null,
      year: null,
      category: null,
      securityLevel: null,
      retentionPeriod: null,
      status: null,
      searchQuery: searchQuery, // 保留搜索关键词
    );
  }
}

/// 档案列表 Provider
final archiveListProvider =
    StateNotifierProvider<ArchiveListNotifier, ArchiveListState>(
  (ref) => ArchiveListNotifier(),
);

/// 档案列表管理
class ArchiveListNotifier extends StateNotifier<ArchiveListState> {
  final ArchiveService _service = ArchiveService();

  ArchiveListNotifier() : super(ArchiveListState());

  /// 加载档案列表
  Future<void> loadArchives() async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      currentPage: 1,
      items: [],
    );

    try {
      print('ArchiveListNotifier: 加载档案列表');

      final result = await _service.getArchiveList(
        page: 1,
        pageSize: state.pageSize,
        search: state.searchQuery,
        categoryId: state.categoryId,
        year: state.year,
        status: state.status,
        sortBy: _getSortByField(),
        sortOrder: state.sortOrder == SortOrder.ascending ? 'asc' : 'desc',
      );

      if (result.success && result.data != null) {
        final totalPages = result.pagination?.totalPages ?? 1;
        final hasMore = state.currentPage < totalPages;

        state = state.copyWith(
          items: result.data!,
          isLoading: false,
          hasMore: hasMore,
        );
        print('ArchiveListNotifier: 成功加载 ${result.data!.length} 个档案');
      } else {
        state = state.copyWith(
          isLoading: false,
          error: result.message ?? '加载档案列表失败',
        );
        print('ArchiveListNotifier: 加载失败 - ${result.message}');
      }
    } catch (e) {
      print('ArchiveListNotifier: 加载异常 - $e');
      state = state.copyWith(
        isLoading: false,
        error: '加载档案列表失败: $e',
      );
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.currentPage + 1;
      print('ArchiveListNotifier: 加载更多 - 页码: $nextPage');

      final result = await _service.getArchiveList(
        page: nextPage,
        pageSize: state.pageSize,
        search: state.searchQuery,
        categoryId: state.categoryId,
        year: state.year,
        status: state.status,
        sortBy: _getSortByField(),
        sortOrder: state.sortOrder == SortOrder.ascending ? 'asc' : 'desc',
      );

      if (result.success && result.data != null) {
        final List<ArchiveItem> newItems = [
          ...state.items,
          ...result.data!,
        ];
        final totalPages = result.pagination?.totalPages ?? 1;
        final hasMore = nextPage < totalPages;

        state = state.copyWith(
          items: newItems,
          currentPage: nextPage,
          isLoadingMore: false,
          hasMore: hasMore,
        );
        print('ArchiveListNotifier: 加载更多成功 - 新增 ${result.data!.length} 个档案');
      } else {
        state = state.copyWith(isLoadingMore: false);
        print('ArchiveListNotifier: 加载更多失败 - ${result.message}');
      }
    } catch (e) {
      print('ArchiveListNotifier: 加载更多异常 - $e');
      state = state.copyWith(isLoadingMore: false);
    }
  }

  /// 刷新列表
  Future<void> refresh() async {
    print('ArchiveListNotifier: 刷新列表');
    await loadArchives();
  }

  /// 设置排序方式
  void setSortType(ArchiveSortType type) {
    state = state.copyWith(sortType: type);
    loadArchives();
  }

  /// 切换排序方向
  void toggleSortOrder() {
    state = state.copyWith(
      sortOrder: state.sortOrder == SortOrder.ascending
          ? SortOrder.descending
          : SortOrder.ascending,
    );
    loadArchives();
  }

  /// 应用筛选条件
  void applyFilters({
    String? categoryId,
    String? year,
    String? status,
  }) {
    print('ArchiveListNotifier: 应用筛选 - categoryId=$categoryId, year=$year, status=$status');
    state = ArchiveListState(
      items: state.items,
      isLoading: state.isLoading,
      isLoadingMore: state.isLoadingMore,
      error: state.error,
      currentPage: 1,
      pageSize: state.pageSize,
      hasMore: state.hasMore,
      sortType: state.sortType,
      sortOrder: state.sortOrder,
      categoryId: categoryId,
      year: year,
      status: status,
    );
    loadArchives();
  }

  /// 清除筛选条件
  void clearFilters() {
    state = state.clearFilters();
    loadArchives();
  }

  /// 设置搜索关键词
  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query);
    loadArchives();
  }

  /// 清除搜索
  void clearSearch() {
    state = state.copyWith(searchQuery: null);
    loadArchives();
  }

  /// 获取排序字段
  String _getSortByField() {
    switch (state.sortType) {
      case ArchiveSortType.time:
        return 'createdAt';
      case ArchiveSortType.name:
        return 'name';
      case ArchiveSortType.relevance:
        return 'relevance';
    }
  }
}
