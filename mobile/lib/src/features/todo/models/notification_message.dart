import 'package:flutter/material.dart';

/// 消息类型
enum NotificationType {
  approval,  // 审批通知
  system,    // 系统通知
  reminder,  // 提醒通知
}

/// 消息通知
class NotificationMessage {
  final String id;
  final NotificationType type;
  final String title;
  final String content;
  final String? relatedId; // 关联的申请ID或借阅ID
  final bool isRead;
  final DateTime createdAt;

  NotificationMessage({
    required this.id,
    required this.type,
    required this.title,
    required this.content,
    this.relatedId,
    this.isRead = false,
    required this.createdAt,
  });

  factory NotificationMessage.fromJson(Map<String, dynamic> json) {
    return NotificationMessage(
      id: json['id'] as String,
      type: _parseNotificationType(json['type'] as String?),
      title: json['title'] as String? ?? '通知',
      content: json['content'] as String? ?? json['title'] as String? ?? '',
      relatedId: json['relatedId'] as String? ?? json['referenceId'] as String?,
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  static NotificationType _parseNotificationType(String? type) {
    switch (type?.toUpperCase()) {
      case 'APPROVAL':
        return NotificationType.approval;
      case 'SYSTEM':
        return NotificationType.system;
      case 'REMINDER':
        return NotificationType.reminder;
      default:
        return NotificationType.system;
    }
  }

  /// 获取类型图标
  IconData getTypeIcon() {
    switch (type) {
      case NotificationType.approval:
        return Icons.approval_outlined;
      case NotificationType.system:
        return Icons.notifications_outlined;
      case NotificationType.reminder:
        return Icons.alarm_outlined;
    }
  }

  /// 获取类型颜色
  Color getTypeColor() {
    switch (type) {
      case NotificationType.approval:
        return Colors.blue;
      case NotificationType.system:
        return Colors.grey;
      case NotificationType.reminder:
        return Colors.orange;
    }
  }

  /// 格式化时间
  String formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return '刚刚';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}分钟前';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}小时前';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}天前';
    } else {
      return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
    }
  }
}
