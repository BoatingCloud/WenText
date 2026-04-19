/// 文件版本
class FileVersion {
  final String id;
  final String fileId;
  final int version;
  final int size;
  final String? comment;
  final String? createdBy;
  final DateTime createdAt;

  FileVersion({
    required this.id,
    required this.fileId,
    required this.version,
    required this.size,
    this.comment,
    this.createdBy,
    required this.createdAt,
  });

  factory FileVersion.fromJson(Map<String, dynamic> json) {
    // 安全解析创建者
    String? createdBy;
    if (json['createdBy'] != null) {
      if (json['createdBy'] is Map) {
        final creator = json['createdBy'] as Map<String, dynamic>;
        createdBy = creator['name'] ?? creator['email'];
      } else if (json['createdBy'] is String) {
        createdBy = json['createdBy'];
      }
    }

    return FileVersion(
      id: json['id'] ?? '',
      fileId: json['fileId'] ?? json['documentId'] ?? '',
      version: json['version'] ?? json['versionNumber'] ?? 1,
      size: json['size'] ?? 0,
      comment: json['comment'] ?? json['description'],
      createdBy: createdBy,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  /// 格式化文件大小
  String getFormattedSize() {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    if (size < 1024 * 1024 * 1024) {
      return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// 格式化时间
  String getFormattedTime() {
    return '${createdAt.year}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')} '
        '${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}';
  }
}
