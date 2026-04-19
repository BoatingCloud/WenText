import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/notification_message.dart';
import '../providers/notifications_provider.dart';
import 'approval_detail_screen.dart';
import 'application_detail_screen.dart';
import 'borrow_detail_screen.dart';

/// 消息通知列表页
class NotificationsScreen extends HookConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notificationsProvider);
    final notifier = ref.read(notificationsProvider.notifier);
    final scrollController = useScrollController();

    // 初始化加载
    useEffect(() {
      Future.microtask(() => notifier.loadNotifications());
      return null;
    }, []);

    // 滚动监听 - 加载更多
    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          if (state.hasMore && !state.isLoadingMore) {
            notifier.loadMore();
          }
        }
      }

      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [state.hasMore, state.isLoadingMore]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('消息通知'),
        actions: [
          // 全部已读按钮
          if (state.unreadCount > 0)
            IconButton(
              icon: const Icon(Symbols.done_all),
              onPressed: () async {
                await notifier.markAllAsRead();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('已全部标记为已读')),
                  );
                }
              },
              tooltip: '全部已读',
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => notifier.refresh(),
        child: _buildBody(context, state, notifier, scrollController),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    NotificationsState state,
    NotificationsNotifier notifier,
    ScrollController scrollController,
  ) {
    if (state.isLoading && state.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.error,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              state.error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => notifier.refresh(),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.items.isEmpty) {
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
      controller: scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: state.items.length + 1,
      separatorBuilder: (context, index) {
        if (index >= state.items.length) return const SizedBox.shrink();
        return const SizedBox(height: 12);
      },
      itemBuilder: (context, index) {
        if (index >= state.items.length) {
          return _buildLoadingIndicator(context, state);
        }
        return _buildNotificationCard(context, state.items[index], notifier);
      },
    );
  }

  Widget _buildLoadingIndicator(
      BuildContext context, NotificationsState state) {
    if (state.isLoadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: CircularProgressIndicator(),
        ),
      );
    } else if (!state.hasMore && state.items.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Text(
            '没有更多内容了',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildNotificationCard(
    BuildContext context,
    NotificationMessage item,
    NotificationsNotifier notifier,
  ) {
    return Dismissible(
      key: Key(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.error,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          Symbols.delete,
          color: Theme.of(context).colorScheme.onError,
        ),
      ),
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('删除消息'),
            content: const Text('确定要删除这条消息吗？'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('取消'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error,
                ),
                child: const Text('删除'),
              ),
            ],
          ),
        );
      },
      onDismissed: (direction) {
        notifier.deleteNotification(item.id);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('消息已删除')),
        );
      },
      child: Card(
        color: item.isRead
            ? null
            : Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
        child: InkWell(
          onTap: () {
            // 标记为已读
            if (!item.isRead) {
              notifier.markAsRead(item.id);
            }

            // 根据消息类型跳转到相应页面
            if (item.relatedId != null) {
              _navigateToDetail(context, item);
            }
          },
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 类型图标
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: item.getTypeColor().withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    item.getTypeIcon(),
                    color: item.getTypeColor(),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 标题
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          // 未读标识
                          if (!item.isRead)
                            Container(
                              margin: const EdgeInsets.only(left: 8),
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.error,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      // 内容
                      Text(
                        item.content,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      // 时间
                      Text(
                        item.formatDateTime(item.createdAt),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                              fontSize: 11,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _navigateToDetail(BuildContext context, NotificationMessage item) {
    if (item.relatedId == null) return;

    Widget? detailScreen;

    switch (item.type) {
      case NotificationType.approval:
        // 审批通知 - 跳转到审批详情或申请详情
        // 这里需要根据实际情况判断是待我审批还是我的申请
        // 简化处理：默认跳转到申请详情
        detailScreen = ApplicationDetailScreen(requestId: item.relatedId!);
        break;
      case NotificationType.system:
      case NotificationType.reminder:
        // 系统通知和提醒通知 - 可能关联借阅记录
        // 这里简化处理，不跳转
        return;
    }

    if (detailScreen != null) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => detailScreen!),
      );
    }
  }
}
