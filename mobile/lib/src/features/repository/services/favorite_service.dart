import 'dart:convert';
import '../../../core/storage/storage_service.dart';
import '../models/favorite_item.dart';

/// 收藏服务
class FavoriteService {
  static final FavoriteService _instance = FavoriteService._internal();
  factory FavoriteService() => _instance;
  FavoriteService._internal();

  final StorageService _storage = StorageService();
  static const String _favoritesKey = 'favorites';

  /// 添加收藏
  Future<void> addFavorite({
    required String fileId,
    required String fileName,
    required String filePath,
    String? fileExtension,
    required String repositoryId,
    required String repositoryName,
  }) async {
    try {
      final favorites = await getFavorites();

      // 检查是否已收藏
      if (favorites.any((f) => f.fileId == fileId)) {
        print('FavoriteService: 文件已收藏 - $fileName');
        return;
      }

      // 添加新收藏
      favorites.insert(
        0,
        FavoriteItem(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          fileId: fileId,
          fileName: fileName,
          filePath: filePath,
          fileExtension: fileExtension,
          repositoryId: repositoryId,
          repositoryName: repositoryName,
          favoritedAt: DateTime.now(),
        ),
      );

      await _saveFavorites(favorites);
      print('FavoriteService: 已添加收藏 - $fileName');
    } catch (e) {
      print('FavoriteService: 添加收藏失败: $e');
    }
  }

  /// 移除收藏
  Future<void> removeFavorite(String fileId) async {
    try {
      final favorites = await getFavorites();
      favorites.removeWhere((f) => f.fileId == fileId);
      await _saveFavorites(favorites);
      print('FavoriteService: 已移除收藏 - $fileId');
    } catch (e) {
      print('FavoriteService: 移除收藏失败: $e');
    }
  }

  /// 检查是否已收藏
  Future<bool> isFavorited(String fileId) async {
    try {
      final favorites = await getFavorites();
      return favorites.any((f) => f.fileId == fileId);
    } catch (e) {
      print('FavoriteService: 检查收藏状态失败: $e');
      return false;
    }
  }

  /// 获取收藏列表
  Future<List<FavoriteItem>> getFavorites() async {
    try {
      final jsonStr = _storage.getFromHive(_favoritesKey);
      if (jsonStr == null) return [];

      final List<dynamic> jsonList = jsonDecode(jsonStr);
      return jsonList.map((json) => FavoriteItem.fromJson(json)).toList();
    } catch (e) {
      print('FavoriteService: 获取收藏列表失败: $e');
      return [];
    }
  }

  /// 清空收藏
  Future<void> clearFavorites() async {
    try {
      await _storage.deleteFromHive(_favoritesKey);
      print('FavoriteService: 已清空收藏');
    } catch (e) {
      print('FavoriteService: 清空收藏失败: $e');
    }
  }

  /// 保存收藏列表
  Future<void> _saveFavorites(List<FavoriteItem> favorites) async {
    final jsonList = favorites.map((f) => f.toJson()).toList();
    final jsonStr = jsonEncode(jsonList);
    await _storage.saveToHive(_favoritesKey, jsonStr);
  }
}
