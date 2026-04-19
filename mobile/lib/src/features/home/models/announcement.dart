/// 公告模型
class Announcement {
  final int id;
  final String title;
  final String content;
  final int isActive;
  final int priority;
  final String? startsAt;
  final String? endsAt;
  final String createdAt;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    required this.isActive,
    required this.priority,
    this.startsAt,
    this.endsAt,
    required this.createdAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'],
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      isActive: json['isActive'] ?? 1,
      priority: json['priority'] ?? 0,
      startsAt: json['startsAt'],
      endsAt: json['endsAt'],
      createdAt: json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'isActive': isActive,
      'priority': priority,
      'startsAt': startsAt,
      'endsAt': endsAt,
      'createdAt': createdAt,
    };
  }

  /// 是否为高优先级（priority >= 100）
  bool get isHighPriority => priority >= 100;
}
