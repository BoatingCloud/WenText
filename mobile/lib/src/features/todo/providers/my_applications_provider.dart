import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/approval_request.dart';
import '../services/todo_service.dart';

/// 我的申请列表状态
class MyApplicationsState {
  final List<ApprovalRequest> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int pageSize;
  final bool hasMore;
  final String? statusFilter;

  MyApplicationsState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.pageSize = 20,
    this.hasMore = true,
    this.statusFilter,
  });

  MyApplicationsState copyWith({
    List<ApprovalRequest>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? pageSize,
    bool? hasMore,
    String? statusFilter,
  }) {
    return MyApplicationsState(
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

/// 我的申请列表 Provider
final myApplicationsProvider =
    StateNotifierProvider<MyApplicationsNotifier, MyApplicationsState>(
  (ref) => MyApplicationsNotifier(),
);

/// 我的申请列表管理
class MyApplicationsNotifier extends StateNotifier<MyApplicationsState> {
  final TodoService _service = TodoService();

  MyApplicationsNotifier() : super(MyApplicationsState());

  /// 加载列表
  Future<void> loadApplications() async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      currentPage: 1,
      items: [],
    );

    try {
      final result = await _service.getMyApplications(
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
      final result = await _service.getMyApplications(
        page: nextPage,
        pageSize: state.pageSize,
        status: state.statusFilter,
      );

      if (result.success && result.data != null) {
        final List<ApprovalRequest> newItems = [
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
    await loadApplications();
  }

  /// 设置状态筛选
  void setStatusFilter(String? status) {
    state = state.copyWith(statusFilter: status);
    loadApplications();
  }
}
