/// 文档模型
class Document {
  final String id;
  final String name;
  final String type; // 'file' or 'folder'
  final String? extension;
  final int? size;
  final String repositoryId;
  final String path;
  final DateTime createdAt;
  final DateTime updatedAt;

  Document({
    required this.id,
    required this.name,
    required this.type,
    this.extension,
    this.size,
    required this.repositoryId,
    required this.path,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Document.fromJson(Map<String, dynamic> json) {
    return Document(
      id: json['id'],
      name: json['name'] ?? '',
      type: json['type'] ?? 'file',
      extension: json['extension'],
      size: json['size'],
      repositoryId: json['repositoryId'] ?? '',
      path: json['path'] ?? '',
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  /// 获取文件图标
  String get iconName {
    if (type == 'folder') return 'folder';

    switch (extension?.toLowerCase()) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'xls':
      case 'xlsx':
        return 'table_chart';
      case 'ppt':
      case 'pptx':
        return 'slideshow';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image';
      case 'zip':
      case 'rar':
      case '7z':
        return 'folder_zip';
      default:
        return 'insert_drive_file';
    }
  }

  /// 格式化文件大小
  String get formattedSize {
    if (size == null) return '';
    if (size! < 1024) return '$size B';
    if (size! < 1024 * 1024) return '${(size! / 1024).toStringAsFixed(1)} KB';
    if (size! < 1024 * 1024 * 1024) return '${(size! / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(size! / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// 获取相对时间
  String getRelativeTime() {
    final now = DateTime.now();
    final difference = now.difference(updatedAt);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';
    if (difference.inDays < 30) return '${(difference.inDays / 7).floor()}周前';
    if (difference.inDays < 365) return '${(difference.inDays / 30).floor()}个月前';
    return '${(difference.inDays / 365).floor()}年前';
  }
}
