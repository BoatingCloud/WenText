/// 文档详情
class DocumentDetail {
  final String id;
  final String name;
  final String path;
  final String type;
  final int size;
  final String? mimeType;
  final String? extension;
  final int version;
  final String repositoryId;
  final String repositoryName;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String? createdBy;
  final String? updatedBy;
  final String? description;
  final List<String>? tags;
  final Map<String, dynamic>? metadata;

  DocumentDetail({
    required this.id,
    required this.name,
    required this.path,
    required this.type,
    required this.size,
    this.mimeType,
    this.extension,
    required this.version,
    required this.repositoryId,
    required this.repositoryName,
    required this.createdAt,
    required this.updatedAt,
    this.createdBy,
    this.updatedBy,
    this.description,
    this.tags,
    this.metadata,
  });

  factory DocumentDetail.fromJson(Map<String, dynamic> json) {
    return DocumentDetail(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      path: json['path'] ?? '',
      type: json['type'] ?? 'file',
      size: json['size'] ?? 0,
      mimeType: json['mimeType'],
      extension: json['extension'],
      version: json['version'] ?? 1,
      repositoryId: json['repositoryId'] ?? '',
      repositoryName: json['repositoryName'] ?? '',
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      createdBy: json['createdBy'],
      updatedBy: json['updatedBy'],
      description: json['description'],
      tags: json['tags'] != null ? List<String>.from(json['tags']) : null,
      metadata: json['metadata'],
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

  /// 获取文件类型描述
  String getFileTypeDescription() {
    final ext = extension?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'PDF 文档';
      case 'doc':
      case 'docx':
        return 'Word 文档';
      case 'xls':
      case 'xlsx':
        return 'Excel 表格';
      case 'ppt':
      case 'pptx':
        return 'PowerPoint 演示文稿';
      case 'jpg':
      case 'jpeg':
        return 'JPEG 图片';
      case 'png':
        return 'PNG 图片';
      case 'gif':
        return 'GIF 图片';
      case 'mp4':
        return 'MP4 视频';
      case 'mp3':
        return 'MP3 音频';
      case 'zip':
        return 'ZIP 压缩包';
      case 'rar':
        return 'RAR 压缩包';
      case 'txt':
        return '文本文件';
      case 'md':
        return 'Markdown 文档';
      default:
        return extension != null ? '${extension!.toUpperCase()} 文件' : '未知类型';
    }
  }

  /// 是否可预览
  bool get canPreview {
    final ext = extension?.toLowerCase();
    return ext != null &&
        ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'md'].contains(ext);
  }

  /// 是否是图片
  bool get isImage {
    final ext = extension?.toLowerCase();
    return ext != null && ['jpg', 'jpeg', 'png', 'gif', 'bmp'].contains(ext);
  }

  /// 是否是PDF
  bool get isPdf {
    return extension?.toLowerCase() == 'pdf';
  }

  /// 是否是文本
  bool get isText {
    final ext = extension?.toLowerCase();
    return ext != null && ['txt', 'md', 'json', 'xml', 'csv'].contains(ext);
  }
}
