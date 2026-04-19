import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/archive_item.dart';
import '../providers/archive_list_provider.dart';
import '../widgets/archive_filter_panel.dart';
import 'archive_detail_screen.dart';

/// 档案列表页面
class ArchiveScreen extends HookConsumerWidget {
  const ArchiveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archiveState = ref.watch(archiveListProvider);
    final archiveNotifier = ref.read(archiveListProvider.notifier);
    final viewMode = useState<ViewMode>(ViewMode.list);
    final scrollController = useScrollController();
    final showSearch = useState<bool>(false);
    final searchController = useTextEditingController();

    // 初始化加载
    useEffect(() {
      Future.microtask(() => archiveNotifier.loadArchives());
      return null;
    }, []);

    // 滚动监听 - 加载更多
    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          if (archiveState.hasMore && !archiveState.isLoadingMore) {
            archiveNotifier.loadMore();
          }
        }
      }

      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [archiveState.hasMore, archiveState.isLoadingMore]);

    return Scaffold(
      appBar: AppBar(
        title: showSearch.value
            ? TextField(
                controller: searchController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: '搜索档案...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                onChanged: (value) {
                  archiveNotifier.setSearchQuery(value);
                },
              )
            : const Text('档案管理'),
        actions: [
          if (showSearch.value)
            IconButton(
              icon: const Icon(Symbols.close),
              onPressed: () {
                showSearch.value = false;
                searchController.clear();
                archiveNotifier.clearSearch();
              },
              tooltip: '关闭搜索',
            )
          else ...[
            // 搜索按钮
            IconButton(
              icon: const Icon(Symbols.search),
              onPressed: () {
                showSearch.value = true;
              },
              tooltip: '搜索档案',
            ),
            // 排序方式下拉
            PopupMenuButton<ArchiveSortType>(
            icon: const Icon(Symbols.sort),
            onSelected: (type) => archiveNotifier.setSortType(type),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: ArchiveSortType.time,
                child: Row(
                  children: [
                    Icon(
                      Symbols.schedule,
                      size: 20,
                      color: archiveState.sortType == ArchiveSortType.time
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '按时间',
                      style: TextStyle(
                        color: archiveState.sortType == ArchiveSortType.time
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: ArchiveSortType.name,
                child: Row(
                  children: [
                    Icon(
                      Symbols.sort_by_alpha,
                      size: 20,
                      color: archiveState.sortType == ArchiveSortType.name
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '按名称',
                      style: TextStyle(
                        color: archiveState.sortType == ArchiveSortType.name
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          // 筛选按钮
          IconButton(
            icon: const Icon(Symbols.filter_list),
            onPressed: () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                builder: (context) => const ArchiveFilterPanel(),
              );
            },
            tooltip: '筛选',
          ),
          // 视图切换
          IconButton(
            icon: Icon(
              viewMode.value == ViewMode.list
                  ? Symbols.grid_view
                  : Symbols.view_list,
            ),
            onPressed: () {
              viewMode.value = viewMode.value == ViewMode.list
                  ? ViewMode.grid
                  : ViewMode.list;
            },
            tooltip: '切换视图',
          ),
        ],
      ],
      ),
      body: RefreshIndicator(
        onRefresh: () => archiveNotifier.refresh(),
        child: _buildBody(
          context,
          archiveState,
          archiveNotifier,
          viewMode.value,
          scrollController,
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ArchiveListState state,
    ArchiveListNotifier notifier,
    ViewMode viewMode,
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
              Symbols.folder_open,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '暂无档案',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    if (viewMode == ViewMode.list) {
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
          return _buildListItem(context, state.items[index]);
        },
      );
    } else {
      return GridView.builder(
        controller: scrollController,
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.75,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: state.items.length + 1,
        itemBuilder: (context, index) {
          if (index >= state.items.length) {
            return _buildLoadingIndicator(context, state);
          }
          return _buildGridItem(context, state.items[index]);
        },
      );
    }
  }

  Widget _buildLoadingIndicator(BuildContext context, ArchiveListState state) {
    if (state.isLoadingMore) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(height: 8),
              Text(
                '加载中...',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
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

  Widget _buildListItem(BuildContext context, ArchiveItem item) {
    return Card(
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ArchiveDetailScreen(archiveId: item.id),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 标题行
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // 状态标签
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: item.getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item.getStatusText(),
                      style: TextStyle(
                        color: item.getStatusColor(),
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // 档案编号
              Text(
                '编号: ${item.archiveNumber}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 4),
              // 责任者和形成日期
              Row(
                children: [
                  if (item.responsiblePerson != null) ...[
                    Icon(
                      Symbols.person,
                      size: 16,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      item.responsiblePerson!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Icon(
                    Symbols.calendar_today,
                    size: 16,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    item.getFormattedFormationDate(),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // 底部标签行
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  if (item.securityLevel != null)
                    _buildTag(
                      context,
                      item.securityLevel!,
                      item.getSecurityLevelColor(),
                    ),
                  if (item.category != null)
                    _buildTag(
                      context,
                      item.category!,
                      Theme.of(context).colorScheme.primary,
                    ),
                  if (item.year != null)
                    _buildTag(
                      context,
                      item.year!,
                      Theme.of(context).colorScheme.secondary,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGridItem(BuildContext context, ArchiveItem item) {
    return Card(
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ArchiveDetailScreen(archiveId: item.id),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 图标或缩略图
              Container(
                height: 80,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Icon(
                    Symbols.folder,
                    size: 48,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // 标题
              Text(
                item.name,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              // 档案编号
              Text(
                item.archiveNumber,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
              // 状态标签
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: item.getStatusColor().withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  item.getStatusText(),
                  style: TextStyle(
                    color: item.getStatusColor(),
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTag(BuildContext context, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

enum ViewMode {
  list,
  grid,
}
