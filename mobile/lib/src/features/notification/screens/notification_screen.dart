import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';

/// 消息通知页面
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<_NotificationItem> _systemNotifications = [
    _NotificationItem(
      id: '1',
      title: '系统维护通知',
      content: '系统将于今晚22:00-24:00进行维护升级，期间可能无法访问',
      time: DateTime.now().subtract(const Duration(hours: 2)),
      isRead: false,
      type: _NotificationType.system,
    ),
    _NotificationItem(
      id: '2',
      title: '版本更新',
      content: '文雨文档管理系统已更新至v0.1.0，新增多项功能',
      time: DateTime.now().subtract(const Duration(days: 1)),
      isRead: true,
      type: _NotificationType.system,
    ),
  ];

  final List<_NotificationItem> _workNotifications = [
    _NotificationItem(
      id: '3',
      title: '借阅申请待审批',
      content: '张三申请借阅《2024年度财务报表》，请及时处理',
      time: DateTime.now().subtract(const Duration(hours: 1)),
      isRead: false,
      type: _NotificationType.approval,
    ),
    _NotificationItem(
      id: '4',
      title: '归档任务提醒',
      content: '您有3份文档待归档，请尽快完成',
      time: DateTime.now().subtract(const Duration(hours: 5)),
      isRead: false,
      type: _NotificationType.todo,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('消息通知'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('工作通知'),
                  if (_getUnreadCount(_workNotifications) > 0) ...[
                    const SizedBox(width: 4),
                    _buildBadge(_getUnreadCount(_workNotifications)),
                  ],
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('系统消息'),
                  if (_getUnreadCount(_systemNotifications) > 0) ...[
                    const SizedBox(width: 4),
                    _buildBadge(_getUnreadCount(_systemNotifications)),
                  ],
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _markAllAsRead,
            child: const Text('全部已读'),
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildNotificationList(_workNotifications),
          _buildNotificationList(_systemNotifications),
        ],
      ),
    );
  }

  Widget _buildBadge(int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.error,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        count > 99 ? '99+' : count.toString(),
        style: TextStyle(
          color: Theme.of(context).colorScheme.onError,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildNotificationList(List<_NotificationItem> notifications) {
    if (notifications.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.notifications_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '暂无消息',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      itemCount: notifications.length,
      separatorBuilder: (context, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final notification = notifications[index];
        return _buildNotificationItem(notification);
      },
    );
  }

  Widget _buildNotificationItem(_NotificationItem notification) {
    return Dismissible(
      key: Key(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Theme.of(context).colorScheme.error,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        child: Icon(
          Symbols.delete,
          color: Theme.of(context).colorScheme.onError,
        ),
      ),
      onDismissed: (direction) {
        setState(() {
          _workNotifications.remove(notification);
          _systemNotifications.remove(notification);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('消息已删除')),
        );
      },
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: notification.isRead
              ? Theme.of(context).colorScheme.surfaceVariant
              : Theme.of(context).colorScheme.primaryContainer,
          child: Icon(
            _getNotificationIcon(notification.type),
            color: notification.isRead
                ? Theme.of(context).colorScheme.onSurfaceVariant
                : Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                notification.title,
                style: TextStyle(
                  fontWeight:
                      notification.isRead ? FontWeight.normal : FontWeight.bold,
                ),
              ),
            ),
            if (!notification.isRead)
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.error,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              notification.content,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(notification.time),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
        onTap: () {
          setState(() {
            notification.isRead = true;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('消息详情功能开发中')),
          );
        },
      ),
    );
  }

  IconData _getNotificationIcon(_NotificationType type) {
    switch (type) {
      case _NotificationType.system:
        return Symbols.info;
      case _NotificationType.approval:
        return Symbols.task_alt;
      case _NotificationType.todo:
        return Symbols.assignment;
      case _NotificationType.message:
        return Symbols.mail;
    }
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';

    return '${time.month}月${time.day}日';
  }

  int _getUnreadCount(List<_NotificationItem> notifications) {
    return notifications.where((n) => !n.isRead).length;
  }

  void _markAllAsRead() {
    setState(() {
      for (var notification in _workNotifications) {
        notification.isRead = true;
      }
      for (var notification in _systemNotifications) {
        notification.isRead = true;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('已全部标记为已读')),
    );
  }
}

enum _NotificationType {
  system,
  approval,
  todo,
  message,
}

class _NotificationItem {
  final String id;
  final String title;
  final String content;
  final DateTime time;
  bool isRead;
  final _NotificationType type;

  _NotificationItem({
    required this.id,
    required this.title,
    required this.content,
    required this.time,
    required this.isRead,
    required this.type,
  });
}
