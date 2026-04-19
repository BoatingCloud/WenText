import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../auth/providers/auth_provider.dart';
import '../../repository/models/repository.dart';
import '../../repository/screens/repository_screen.dart';
import '../../repository/screens/directory_browser_screen.dart';
import '../../archive/screens/archive_screen.dart';
import '../../search/screens/search_screen.dart';
import '../../notification/screens/notification_screen.dart';
import '../../todo/providers/todo_count_provider.dart';
import '../../todo/screens/todo_center_screen.dart';
import '../../todo/screens/notifications_screen.dart';
import '../models/todo_stats.dart';
import '../models/recent_visit.dart';
import '../providers/home_provider.dart';
import '../widgets/announcement_marquee.dart';
import 'announcement_list_screen.dart';

/// 首页工作台
class HomeScreen extends HookConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final homeState = ref.watch(homeProvider);
    final homeNotifier = ref.read(homeProvider.notifier);
    final todoCount = ref.watch(todoCountProvider);
    final todoCountNotifier = ref.read(todoCountProvider.notifier);

    // 获取问候语
    String getGreeting() {
      final hour = DateTime.now().hour;
      if (hour < 12) return '上午好';
      if (hour < 18) return '下午好';
      return '晚上好';
    }

    // 初始化加载
    useEffect(() {
      // 使用 Future.microtask 延迟到 build 完成后执行
      Future.microtask(() {
        homeNotifier.loadAll();
        todoCountNotifier.loadCount();
      });
      return null;
    }, []);

    return Scaffold(
      appBar: AppBar(
        title: Text('${getGreeting()}，${user?.name ?? '用户'}'),
        actions: [
          IconButton(
            icon: const Icon(Symbols.search),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SearchScreen()),
              );
            },
          ),
          // 消息通知按钮（带角标）
          Stack(
            children: [
              IconButton(
                icon: const Icon(Symbols.notifications),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const NotificationsScreen()),
                  );
                },
              ),
              if (todoCount.unreadNotifications > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.error,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      todoCount.unreadNotifications > 99
                          ? '99+'
                          : todoCount.unreadNotifications.toString(),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onError,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => homeNotifier.refresh(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // 公告滚动条
            if (homeState.announcements.isNotEmpty)
              AnnouncementMarquee(
                announcements: homeState.announcements,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const AnnouncementListScreen()),
                  );
                },
              ),
            if (homeState.announcements.isNotEmpty) const SizedBox(height: 16),

            // 快捷入口
            _buildQuickActions(context, todoCount.totalCount),
            const SizedBox(height: 24),

            // 最近访问
            _buildRecentVisits(context, homeState.recentVisits),
            const SizedBox(height: 24),

            // 待办事项
            _buildTodoSection(context, homeState.todoStats, todoCount.pendingApprovals, todoCount.myApplications, todoCount.myBorrows),
            const SizedBox(height: 24),

            // 常用仓库
            _buildFavoriteRepositories(context, homeState.repositories),
          ],
        ),
      ),
    );
  }

  /// 快捷入口
  Widget _buildQuickActions(BuildContext context, int todoCountTotal) {
    final actions = [
      _QuickAction(
        icon: Symbols.edit_document,
        label: '档案录入',
        enabled: false,
        onTap: () {},
      ),
      _QuickAction(
        icon: Symbols.storage,
        label: '仓库浏览',
        enabled: true,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const RepositoryScreen()),
          );
        },
      ),
      _QuickAction(
        icon: Symbols.library_books,
        label: '档案管理',
        enabled: true,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const ArchiveScreen()),
          );
        },
      ),
      _QuickAction(
        icon: Symbols.task_alt,
        label: '待办审批',
        enabled: true,
        badge: todoCountTotal,
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const TodoCenterScreen()),
          );
        },
      ),
      _QuickAction(
        icon: Symbols.qr_code_scanner,
        label: '扫一扫',
        enabled: false,
        onTap: () {},
      ),
      _QuickAction(
        icon: Symbols.star,
        label: '离线收藏',
        enabled: true,
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('离线收藏功能开发中')),
          );
        },
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '快捷入口',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 1.2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            return _buildQuickActionItem(context, action);
          },
        ),
      ],
    );
  }

  Widget _buildQuickActionItem(BuildContext context, _QuickAction action) {
    return Card(
      child: InkWell(
        onTap: action.enabled ? action.onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Opacity(
          opacity: action.enabled ? 1.0 : 0.4,
          child: Stack(
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    action.icon,
                    size: 32,
                    color: action.enabled
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    action.label,
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
              // 角标
              if (action.badge != null && action.badge! > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.error,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 18,
                      minHeight: 18,
                    ),
                    child: Text(
                      action.badge! > 99 ? '99+' : action.badge!.toString(),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onError,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// 最近访问
  Widget _buildRecentVisits(BuildContext context, List<RecentVisit> recentVisits) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '最近访问',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('查看全部功能开发中')),
                );
              },
              child: const Text('查看全部'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        recentVisits.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(
                    '暂无最近访问记录',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ),
              )
            : SizedBox(
                height: 120,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: recentVisits.length,
                  itemBuilder: (context, index) {
                    return _buildRecentVisitCard(context, recentVisits[index]);
                  },
                ),
              ),
      ],
    );
  }

  Widget _buildRecentVisitCard(BuildContext context, RecentVisit visit) {
    return Card(
      margin: const EdgeInsets.only(right: 12),
      child: InkWell(
        onTap: () {
          // 创建 Repository 对象
          final repository = Repository(
            id: visit.repositoryId,
            name: visit.repositoryName,
            code: '',
            description: '',
            storageType: 'local',
            storagePath: '',
            versionEnabled: false,
            encryptEnabled: false,
            status: 'active',
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );

          // 跳转到目录浏览器
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DirectoryBrowserScreen(
                repository: repository,
                initialPath: visit.path,
              ),
            ),
          );
        },
        child: Container(
          width: 140,
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                _getDocumentIcon(visit.iconName ?? 'insert_drive_file'),
                color: Theme.of(context).colorScheme.primary,
                size: 32,
              ),
              const Spacer(),
              Text(
                visit.name,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                visit.getRelativeTime(),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getDocumentIcon(String iconName) {
    switch (iconName) {
      case 'folder':
        return Symbols.folder;
      case 'picture_as_pdf':
        return Symbols.picture_as_pdf;
      case 'description':
        return Symbols.description;
      case 'table_chart':
        return Symbols.table_chart;
      case 'slideshow':
        return Symbols.slideshow;
      case 'image':
        return Symbols.image;
      case 'folder_zip':
        return Symbols.folder_zip;
      default:
        return Symbols.insert_drive_file;
    }
  }

  /// 待办事项
  Widget _buildTodoSection(BuildContext context, TodoStats? stats, int pendingApprovals, int myApplications, int myBorrows) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '待办事项',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const TodoCenterScreen()),
                );
              },
              child: const Text('查看全部'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _buildTodoCard(
                context,
                '待审批',
                pendingApprovals,
                Symbols.task_alt,
                () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const TodoCenterScreen()),
                  );
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTodoCard(
                context,
                '我的申请',
                myApplications,
                Symbols.description,
                () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const TodoCenterScreen()),
                  );
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTodoCard(
                context,
                '我的借阅',
                myBorrows,
                Symbols.library_books,
                () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const TodoCenterScreen()),
                  );
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTodoCard(BuildContext context, String title, int count, IconData icon, VoidCallback onTap) {
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Icon(
                icon,
                color: Theme.of(context).colorScheme.primary,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                count.toString(),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 常用仓库
  Widget _buildFavoriteRepositories(BuildContext context, List<Repository> repos) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '常用仓库',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        repos.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text(
                    '暂无可访问的仓库',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ),
              )
            : SizedBox(
                height: 100,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: repos.length,
                  itemBuilder: (context, index) {
                    return _buildRepositoryItem(context, repos[index]);
                  },
                ),
              ),
      ],
    );
  }

  Widget _buildRepositoryItem(BuildContext context, Repository repo) {
    return Card(
      margin: const EdgeInsets.only(right: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const RepositoryScreen()),
          );
        },
        child: Container(
          width: 100,
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Symbols.folder,
                color: Theme.of(context).colorScheme.primary,
                size: 32,
              ),
              const SizedBox(height: 8),
              Text(
                repo.name,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 快捷操作
class _QuickAction {
  final IconData icon;
  final String label;
  final bool enabled;
  final VoidCallback onTap;
  final int? badge;

  _QuickAction({
    required this.icon,
    required this.label,
    required this.enabled,
    required this.onTap,
    this.badge,
  });
}
