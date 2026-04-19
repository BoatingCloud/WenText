import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/borrow_record.dart';
import '../services/todo_service.dart';

/// 我的借阅列表状态
class MyBorrowsState {
  final List<BorrowRecord> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int pageSize;
  final bool hasMore;
  final String? statusFilter;

  MyBorrowsState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.pageSize = 20,
    this.hasMore = true,
    this.statusFilter,
  });

  MyBorrowsState copyWith({
    List<BorrowRecord>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? pageSize,
    bool? hasMore,
    String? statusFilter,
  }) {
    return MyBorrowsState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
      statusFilter: statusFilter ?? this.statusFilter,
    );
  }
}

/// 我的借阅列表 Provider
final myBorrowsProvider =
    StateNotifierProvider<MyBorrowsNotifier, MyBorrowsState>(
  (ref) => MyBorrowsNotifier(),
);

/// 我的借阅列表管理
class MyBorrowsNotifier extends StateNotifier<MyBorrowsState> {
  final TodoService _service = TodoService();

  MyBorrowsNotifier() : super(MyBorrowsState());

  /// 加载列表
  Future<void> loadBorrows() async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      currentPage: 1,
      items: [],
    );

    try {
      final result = await _service.getMyBorrows(
        page: 1,
        pageSize: state.pageSize,
        status: state.statusFilter,
      );

      if (result.success && result.data != null) {
        final totalPages = result.pagination?.totalPages ?? 1;
        final hasMore = state.currentPage < totalPages;

        state = state.copyWith(
          items: result.data!,
          isLoading: false,
          hasMore: hasMore,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: result.message ?? '加载失败',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: '加载失败: $e',
      );
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.currentPage + 1;
      final result = await _service.getMyBorrows(
        page: nextPage,
        pageSize: state.pageSize,
        status: state.statusFilter,
      );

      if (result.success && result.data != null) {
        final List<BorrowRecord> newItems = [
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
      } else {
        state = state.copyWith(isLoadingMore: false);
      }
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  /// 刷新列表
  Future<void> refresh() async {
    await loadBorrows();
  }

  /// 设置状态筛选
  void setStatusFilter(String? status) {
    state = state.copyWith(statusFilter: status);
    loadBorrows();
  }
}
