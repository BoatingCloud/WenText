import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/repository.dart';
import '../services/repository_service.dart';

/// 仓库列表状态
class RepositoryListState {
  final List<Repository> repositories;
  final bool isLoading;
  final String? error;

  RepositoryListState({
    this.repositories = const [],
    this.isLoading = false,
    this.error,
  });

  RepositoryListState copyWith({
    List<Repository>? repositories,
    bool? isLoading,
    String? error,
  }) {
    return RepositoryListState(
      repositories: repositories ?? this.repositories,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 仓库列表 Provider
final repositoryListProvider =
    StateNotifierProvider<RepositoryListNotifier, RepositoryListState>(
  (ref) => RepositoryListNotifier(),
);

/// 仓库列表管理
class RepositoryListNotifier extends StateNotifier<RepositoryListState> {
  final RepositoryService _service = RepositoryService();

  RepositoryListNotifier() : super(RepositoryListState());

  /// 加载仓库列表
  Future<void> loadRepositories() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      print('RepositoryListNotifier: 开始加载仓库列表');
      final result = await _service.getAccessibleRepositories();

      if (result.success && result.data != null) {
        state = state.copyWith(
          repositories: result.data!,
          isLoading: false,
        );
        print('RepositoryListNotifier: 成功加载 ${result.data!.length} 个仓库');
      } else {
        state = state.copyWith(
          isLoading: false,
          error: result.message ?? '加载仓库列表失败',
        );
        print('RepositoryListNotifier: 加载失败 - ${result.message}');
      }
    } catch (e) {
      print('RepositoryListNotifier: 加载异常 - $e');
      state = state.copyWith(
        isLoading: false,
        error: '加载仓库列表失败: $e',
      );
    }
  }

  /// 刷新仓库列表
  Future<void> refresh() async {
    print('RepositoryListNotifier: 刷新仓库列表');
    await loadRepositories();
  }
}
