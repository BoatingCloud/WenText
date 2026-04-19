import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/favorite_item.dart';
import '../services/favorite_service.dart';

/// 收藏管理状态
class FavoriteManagerState {
  final List<FavoriteItem> favorites;
  final Set<String> favoritedFileIds;
  final bool isLoading;

  FavoriteManagerState({
    this.favorites = const [],
    this.favoritedFileIds = const {},
    this.isLoading = false,
  });

  FavoriteManagerState copyWith({
    List<FavoriteItem>? favorites,
    Set<String>? favoritedFileIds,
    bool? isLoading,
  }) {
    return FavoriteManagerState(
      favorites: favorites ?? this.favorites,
      favoritedFileIds: favoritedFileIds ?? this.favoritedFileIds,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  bool isFavorited(String fileId) => favoritedFileIds.contains(fileId);
}

/// 收藏管理 Provider
final favoriteManagerProvider =
    StateNotifierProvider<FavoriteManagerNotifier, FavoriteManagerState>(
  (ref) => FavoriteManagerNotifier(),
);

/// 收藏管理
class FavoriteManagerNotifier extends StateNotifier<FavoriteManagerState> {
  final FavoriteService _service = FavoriteService();

  FavoriteManagerNotifier() : super(FavoriteManagerState()) {
    loadFavorites();
  }

  /// 加载收藏列表
  Future<void> loadFavorites() async {
    state = state.copyWith(isLoading: true);

    try {
      final favorites = await _service.getFavorites();
      final fileIds = favorites.map((f) => f.fileId).toSet();

      state = state.copyWith(
        favorites: favorites,
        favoritedFileIds: fileIds,
        isLoading: false,
      );

      print('FavoriteManager: 加载了 ${favorites.length} 个收藏');
    } catch (e) {
      print('FavoriteManager: 加载收藏失败: $e');
      state = state.copyWith(isLoading: false);
    }
  }

  /// 切换收藏状态
  Future<void> toggleFavorite({
    required String fileId,
    required String fileName,
    required String filePath,
    String? fileExtension,
    required String repositoryId,
    required String repositoryName,
  }) async {
    final isFavorited = state.isFavorited(fileId);

    if (isFavorited) {
      await _service.removeFavorite(fileId);
    } else {
      await _service.addFavorite(
        fileId: fileId,
        fileName: fileName,
        filePath: filePath,
        fileExtension: fileExtension,
        repositoryId: repositoryId,
        repositoryName: repositoryName,
      );
    }

    // 重新加载收藏列表
    await loadFavorites();
  }

  /// 移除收藏
  Future<void> removeFavorite(String fileId) async {
    await _service.removeFavorite(fileId);
    await loadFavorites();
  }

  /// 清空收藏
  Future<void> clearFavorites() async {
    await _service.clearFavorites();
    state = state.copyWith(
      favorites: [],
      favoritedFileIds: {},
    );
  }
}
