/// 最近访问记录
class RecentVisit {
  final String id;
  final String name;
  final String type; // 'document' or 'folder'
  final String? iconName;
  final String repositoryId;
  final String repositoryName;
  final String path;
  final DateTime visitedAt;

  RecentVisit({
    required this.id,
    required this.name,
    required this.type,
    this.iconName,
    required this.repositoryId,
    required this.repositoryName,
    required this.path,
    required this.visitedAt,
  });

  factory RecentVisit.fromJson(Map<String, dynamic> json) {
    return RecentVisit(
      id: json['id'],
      name: json['name'],
      type: json['type'],
      iconName: json['iconName'],
      repositoryId: json['repositoryId'],
      repositoryName: json['repositoryName'],
      path: json['path'],
      visitedAt: DateTime.parse(json['visitedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'iconName': iconName,
      'repositoryId': repositoryId,
      'repositoryName': repositoryName,
      'path': path,
      'visitedAt': visitedAt.toIso8601String(),
    };
  }

  /// 获取相对时间
  String getRelativeTime() {
    final now = DateTime.now();
    final difference = now.difference(visitedAt);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';
    if (difference.inDays < 30) return '${(difference.inDays / 7).floor()}周前';
    if (difference.inDays < 365) return '${(difference.inDays / 30).floor()}个月前';
    return '${(difference.inDays / 365).floor()}年前';
  }
}
