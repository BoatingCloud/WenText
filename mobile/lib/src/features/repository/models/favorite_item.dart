/// 收藏项目
class FavoriteItem {
  final String id;
  final String fileId;
  final String fileName;
  final String filePath;
  final String? fileExtension;
  final String repositoryId;
  final String repositoryName;
  final DateTime favoritedAt;

  FavoriteItem({
    required this.id,
    required this.fileId,
    required this.fileName,
    required this.filePath,
    this.fileExtension,
    required this.repositoryId,
    required this.repositoryName,
    required this.favoritedAt,
  });

  factory FavoriteItem.fromJson(Map<String, dynamic> json) {
    return FavoriteItem(
      id: json['id'] ?? '',
      fileId: json['fileId'] ?? '',
      fileName: json['fileName'] ?? '',
      filePath: json['filePath'] ?? '',
      fileExtension: json['fileExtension'],
      repositoryId: json['repositoryId'] ?? '',
      repositoryName: json['repositoryName'] ?? '',
      favoritedAt: DateTime.parse(json['favoritedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fileId': fileId,
      'fileName': fileName,
      'filePath': filePath,
      'fileExtension': fileExtension,
      'repositoryId': repositoryId,
      'repositoryName': repositoryName,
      'favoritedAt': favoritedAt.toIso8601String(),
    };
  }

  /// 获取相对时间
  String getRelativeTime() {
    final now = DateTime.now();
    final difference = now.difference(favoritedAt);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';

    return '${favoritedAt.year}-${favoritedAt.month.toString().padLeft(2, '0')}-${favoritedAt.day.toString().padLeft(2, '0')}';
  }
}
