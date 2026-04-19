/// 文件/文件夹项目
class FileItem {
  final String id;
  final String name;
  final String type; // 'file' or 'folder'
  final String path;
  final int? size;
  final String? mimeType;
  final DateTime? modifiedAt;
  final DateTime? createdAt;
  final String? extension;
  final int? version;
  final String? createdBy;
  final String? updatedBy;
  final List<String>? tags;
  final String? description;
  final Map<String, dynamic>? metadata;

  FileItem({
    required this.id,
    required this.name,
    required this.type,
    required this.path,
    this.size,
    this.mimeType,
    this.modifiedAt,
    this.createdAt,
    this.extension,
    this.version,
    this.createdBy,
    this.updatedBy,
    this.tags,
    this.description,
    this.metadata,
  });

  bool get isFolder => type == 'folder';
  bool get isFile => type == 'file';

  factory FileItem.fromJson(Map<String, dynamic> json) {
    // API 返回的 type 是大写的 FILE/FOLDER,需要转换为小写
    final typeValue = (json['type'] ?? 'FILE').toString().toLowerCase();

    // 解析标签
    List<String>? tags;
    if (json['tags'] != null) {
      if (json['tags'] is List) {
        tags = (json['tags'] as List).map((e) => e.toString()).toList();
      }
    }

    // 安全解析创建者和修改者
    String? createdBy;
    if (json['createdBy'] != null && json['createdBy'] is Map) {
      final creator = json['createdBy'] as Map<String, dynamic>;
      createdBy = creator['name'] ?? creator['email'];
    }

    String? updatedBy;
    if (json['updatedBy'] != null && json['updatedBy'] is Map) {
      final updater = json['updatedBy'] as Map<String, dynamic>;
      updatedBy = updater['name'] ?? updater['email'];
    }

    // 解析扩展名：优先使用 API 返回的 extension 字段，否则从文件名中提取
    String? extension = json['extension'];
    final name = json['name'] ?? '';

    if (extension == null || extension.isEmpty) {
      if (name.contains('.')) {
        extension = name.split('.').last.toLowerCase();
        print('FileItem: 从文件名提取扩展名 - 文件名: $name, 扩展名: $extension');
      }
    } else {
      // 确保扩展名是小写且不包含点号
      extension = extension.toLowerCase().replaceAll('.', '');
      print('FileItem: 使用API返回的扩展名 - 文件名: $name, 扩展名: $extension');
    }

    return FileItem(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      type: typeValue,
      path: json['path'] ?? '',
      size: json['size'],
      mimeType: json['mimeType'],
      modifiedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
      extension: extension,
      version: json['_count']?['versions'],
      createdBy: createdBy,
      updatedBy: updatedBy,
      tags: tags,
      description: json['description'],
      metadata: json['metadata'],
    );
  }

  /// 格式化文件大小
  String getFormattedSize() {
    if (size == null) return '-';
    if (size! < 1024) return '$size B';
    if (size! < 1024 * 1024) return '${(size! / 1024).toStringAsFixed(1)} KB';
    if (size! < 1024 * 1024 * 1024) {
      return '${(size! / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(size! / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// 获取相对时间
  String getRelativeTime() {
    if (modifiedAt == null) return '-';
    final now = DateTime.now();
    final difference = now.difference(modifiedAt!);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';
    if (difference.inDays < 30) return '${(difference.inDays / 7).floor()}周前';
    if (difference.inDays < 365) return '${(difference.inDays / 30).floor()}个月前';

    return '${modifiedAt!.year}-${modifiedAt!.month.toString().padLeft(2, '0')}-${modifiedAt!.day.toString().padLeft(2, '0')}';
  }
}
