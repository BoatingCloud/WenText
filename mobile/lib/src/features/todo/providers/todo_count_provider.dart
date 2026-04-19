import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../services/todo_service.dart';

/// 待办数量状态
class TodoCountState {
  final int pendingApprovals;
  final int myApplications;
  final int myBorrows;
  final int unreadNotifications;
  final bool isLoading;

  TodoCountState({
    this.pendingApprovals = 0,
    this.myApplications = 0,
    this.myBorrows = 0,
    this.unreadNotifications = 0,
    this.isLoading = false,
  });

  TodoCountState copyWith({
    int? pendingApprovals,
    int? myApplications,
    int? myBorrows,
    int? unreadNotifications,
    bool? isLoading,
  }) {
    return TodoCountState(
      pendingApprovals: pendingApprovals ?? this.pendingApprovals,
      myApplications: myApplications ?? this.myApplications,
      myBorrows: myBorrows ?? this.myBorrows,
      unreadNotifications: unreadNotifications ?? this.unreadNotifications,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  /// 总待办数量
  int get totalCount =>
      pendingApprovals + myApplications + myBorrows + unreadNotifications;
}

/// 待办数量 Provider
final todoCountProvider =
    StateNotifierProvider<TodoCountNotifier, TodoCountState>(
  (ref) => TodoCountNotifier(),
);

/// 待办数量管理
class TodoCountNotifier extends StateNotifier<TodoCountState> {
  final TodoService _service = TodoService();

  TodoCountNotifier() : super(TodoCountState());

  /// 加载待办数量
  Future<void> loadCount() async {
    state = state.copyWith(isLoading: true);

    try {
      final result = await _service.getTodoCount();

      if (result.success && result.data != null) {
        state = TodoCountState(
          pendingApprovals: result.data!['pendingApprovals'] ?? 0,
          myApplications: result.data!['myApplications'] ?? 0,
          myBorrows: result.data!['myBorrows'] ?? 0,
          unreadNotifications: result.data!['unreadNotifications'] ?? 0,
          isLoading: false,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  /// 刷新待办数量
  Future<void> refresh() async {
    await loadCount();
  }
}
