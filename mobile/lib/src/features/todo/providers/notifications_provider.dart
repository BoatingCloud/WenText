import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/notification_message.dart';
import '../services/todo_service.dart';

/// 消息通知列表状态
class NotificationsState {
  final List<NotificationMessage> items;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int pageSize;
  final bool hasMore;
  final String? typeFilter;

  NotificationsState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.pageSize = 20,
    this.hasMore = true,
    this.typeFilter,
  });

  NotificationsState copyWith({
    List<NotificationMessage>? items,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? pageSize,
    bool? hasMore,
    String? typeFilter,
  }) {
    return NotificationsState(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
      typeFilter: typeFilter ?? this.typeFilter,
    );
  }

  /// 未读数量
  int get unreadCount => items.where((item) => !item.isRead).length;
}

/// 消息通知列表 Provider
final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, NotificationsState>(
  (ref) => NotificationsNotifier(),
);

/// 消息通知列表管理
class NotificationsNotifier extends StateNotifier<NotificationsState> {
  final TodoService _service = TodoService();

  NotificationsNotifier() : super(NotificationsState());

  /// 加载列表
  Future<void> loadNotifications() async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      currentPage: 1,
      items: [],
    );

    try {
      final result = await _service.getNotifications(
        page: 1,
        pageSize: state.pageSize,
        type: state.typeFilter,
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
      final result = await _service.getNotifications(
        page: nextPage,
        pageSize: state.pageSize,
        type: state.typeFilter,
      );

      if (result.success && result.data != null) {
        final List<NotificationMessage> newItems = [
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
    await loadNotifications();
  }

  /// 设置类型筛选
  void setTypeFilter(String? type) {
    state = state.copyWith(typeFilter: type);
    loadNotifications();
  }

  /// 标记消息已读
  Future<void> markAsRead(String id) async {
    final service = TodoService();
    final result = await service.markNotificationAsRead(id);

    if (result.success) {
      // 更新本地状态
      final updatedItems = state.items.map((item) {
        if (item.id == id) {
          return NotificationMessage(
            id: item.id,
            type: item.type,
            title: item.title,
            content: item.content,
            relatedId: item.relatedId,
            isRead: true,
            createdAt: item.createdAt,
          );
        }
        return item;
      }).toList();

      state = state.copyWith(items: updatedItems);
    }
  }

  /// 标记所有消息已读
  Future<void> markAllAsRead() async {
    final service = TodoService();
    final result = await service.markAllNotificationsAsRead();

    if (result.success) {
      // 更新本地状态
      final updatedItems = state.items.map((item) {
        return NotificationMessage(
          id: item.id,
          type: item.type,
          title: item.title,
          content: item.content,
          relatedId: item.relatedId,
          isRead: true,
          createdAt: item.createdAt,
        );
      }).toList();

      state = state.copyWith(items: updatedItems);
    }
  }

  /// 删除消息
  Future<void> deleteNotification(String id) async {
    final service = TodoService();
    final result = await service.deleteNotification(id);

    if (result.success) {
      // 更新本地状态
      final updatedItems = state.items.where((item) => item.id != id).toList();
      state = state.copyWith(items: updatedItems);
    }
  }
}
