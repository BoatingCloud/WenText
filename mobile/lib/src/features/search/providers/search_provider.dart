import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../../core/storage/storage_service.dart';
import '../../archive/models/archive_item.dart';
import '../services/global_search_service.dart';

/// 搜索历史 Provider
final searchHistoryProvider =
    StateNotifierProvider<SearchHistoryNotifier, List<String>>(
  (ref) => SearchHistoryNotifier(),
);

/// 搜索历史管理
class SearchHistoryNotifier extends StateNotifier<List<String>> {
  static const String _storageKey = 'search_history';
  static const int _maxHistory = 20;

  SearchHistoryNotifier() : super([]) {
    _loadHistory();
  }

  void _loadHistory() {
    final storage = StorageService();
    final history = storage.getFromHive(_storageKey, defaultValue: <dynamic>[]);
    if (history is List) {
      state = history.map((e) => e.toString()).toList();
    }
  }

  void addHistory(String keyword) {
    if (keyword.trim().isEmpty) return;
    final newHistory = [keyword, ...state.where((e) => e != keyword)];
    if (newHistory.length > _maxHistory) {
      state = newHistory.sublist(0, _maxHistory);
    } else {
      state = newHistory;
    }
    _saveHistory();
  }

  void removeHistory(String keyword) {
    state = state.where((e) => e != keyword).toList();
    _saveHistory();
  }

  void clearHistory() {
    state = [];
    _saveHistory();
  }

  void _saveHistory() {
    StorageService().saveToHive(_storageKey, state);
  }
}

/// 搜索结果状态
class SearchResultState {
  final List<ArchiveItem> archiveResults;
  final bool isLoading;
  final String? error;
  final String query;
  final int currentPage;
  final bool hasMore;
  // 高级搜索筛选
  final String? categoryId;
  final String? year;
  final String? status;

  SearchResultState({
    this.archiveResults = const [],
    this.isLoading = false,
    this.error,
    this.query = '',
    this.currentPage = 1,
    this.hasMore = true,
    this.categoryId,
    this.year,
    this.status,
  });

  SearchResultState copyWith({
    List<ArchiveItem>? archiveResults,
    bool? isLoading,
    String? error,
    String? query,
    int? currentPage,
    bool? hasMore,
    String? categoryId,
    String? year,
    String? status,
  }) {
    return SearchResultState(
      archiveResults: archiveResults ?? this.archiveResults,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      query: query ?? this.query,
      currentPage: currentPage ?? this.currentPage,
      hasMore: hasMore ?? this.hasMore,
      categoryId: categoryId ?? this.categoryId,
      year: year ?? this.year,
      status: status ?? this.status,
    );
  }

  bool get hasFilters =>
      categoryId != null || year != null || status != null;
}

/// 搜索结果 Provider
final searchResultProvider =
    StateNotifierProvider<SearchResultNotifier, SearchResultState>(
  (ref) => SearchResultNotifier(ref),
);

/// 搜索结果管理
class SearchResultNotifier extends StateNotifier<SearchResultState> {
  final Ref _ref;
  final GlobalSearchService _service = GlobalSearchService();

  SearchResultNotifier(this._ref) : super(SearchResultState());

  /// 执行搜索
  Future<void> search(String query) async {
    if (query.trim().isEmpty) return;

    _ref.read(searchHistoryProvider.notifier).addHistory(query);

    state = state.copyWith(
      query: query,
      isLoading: true,
      archiveResults: [],
      currentPage: 1,
      hasMore: true,
    );

    try {
      final result = await _service.searchArchives(
        query: query,
        page: 1,
        pageSize: 20,
        categoryId: state.categoryId,
        year: state.year,
        status: state.status,
      );

      if (result.success && result.data != null) {
        final totalPages = result.pagination?.totalPages ?? 1;
        state = state.copyWith(
          archiveResults: result.data!,
          isLoading: false,
          hasMore: 1 < totalPages,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: result.message ?? '搜索失败',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: '搜索失败: $e',
      );
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore) return;

    state = state.copyWith(isLoading: true);
    final nextPage = state.currentPage + 1;

    try {
      final result = await _service.searchArchives(
        query: state.query,
        page: nextPage,
        pageSize: 20,
        categoryId: state.categoryId,
        year: state.year,
        status: state.status,
      );

      if (result.success && result.data != null) {
        final totalPages = result.pagination?.totalPages ?? 1;
        final List<ArchiveItem> newItems = [
          ...state.archiveResults,
          ...result.data!,
        ];
        state = state.copyWith(
          archiveResults: newItems,
          currentPage: nextPage,
          isLoading: false,
          hasMore: nextPage < totalPages,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  /// 清除结果
  void clear() {
    state = SearchResultState();
  }

  /// 应用高级搜索筛选
  void applyFilters({
    String? categoryId,
    String? year,
    String? status,
  }) {
    state = state.copyWith(
      categoryId: categoryId,
      year: year,
      status: status,
    );
    if (state.query.isNotEmpty) {
      search(state.query);
    }
  }

  /// 清除筛选条件
  void clearFilters() {
    state = SearchResultState(query: state.query);
    if (state.query.isNotEmpty) {
      search(state.query);
    }
  }
}
