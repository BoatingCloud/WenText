import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/file_item.dart';
import '../models/repository.dart';
import '../providers/file_browser_provider.dart';
import 'document_detail_screen.dart';
import 'document_search_screen.dart';

/// 目录浏览页面
class DirectoryBrowserScreen extends HookConsumerWidget {
  final Repository repository;
  final String initialPath;

  const DirectoryBrowserScreen({
    super.key,
    required this.repository,
    this.initialPath = '',
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final browserState = ref.watch(fileBrowserProvider(repository.id));
    final browserNotifier = ref.read(fileBrowserProvider(repository.id).notifier);
    final viewMode = useState<ViewMode>(ViewMode.list);
    final scrollController = useScrollController();
    final showLocalSearch = useState<bool>(false);
    final searchController = useTextEditingController();

    // 初始化加载
    useEffect(() {
      Future.microtask(() => browserNotifier.loadDirectory(path: initialPath));
      return null;
    }, []);

    // 滚动监听 - 加载更多
    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          // 距离底部200像素时触发加载更多
          if (browserState.hasMore && !browserState.isLoadingMore) {
            browserNotifier.loadMore();
          }
        }
      }

      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [browserState.hasMore, browserState.isLoadingMore]);

    return Scaffold(
      appBar: AppBar(
        title: showLocalSearch.value
            ? TextField(
                controller: searchController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: '在当前目录中搜索...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                onChanged: (value) {
                  browserNotifier.setSearchQuery(value);
                },
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(repository.name),
                  if (browserState.currentPath.isNotEmpty)
                    Text(
                      browserState.currentPath,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                ],
              ),
        actions: [
          if (showLocalSearch.value)
            IconButton(
              icon: const Icon(Symbols.close),
              onPressed: () {
                showLocalSearch.value = false;
                searchController.clear();
                browserNotifier.clearSearch();
              },
              tooltip: '关闭搜索',
            )
          else ...[
            IconButton(
              icon: const Icon(Symbols.search),
              onPressed: () {
                showLocalSearch.value = true;
              },
              tooltip: '在当前目录搜索',
            ),
            PopupMenuButton<String>(
              icon: const Icon(Symbols.more_vert),
              onSelected: (value) {
                if (value == 'global_search') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => DocumentSearchScreen(
                        repository: repository,
                      ),
                    ),
                  );
                }
              },
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'global_search',
                  child: Row(
                    children: [
                      Icon(Symbols.travel_explore),
                      SizedBox(width: 12),
                      Text('全局搜索'),
                    ],
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Symbols.sort),
              onPressed: () => _showSortOptions(context, browserState, browserNotifier),
            ),
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
            ),
            IconButton(
              icon: const Icon(Symbols.refresh),
              onPressed: () => browserNotifier.refresh(),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          // 面包屑导航
          if (browserState.currentPath.isNotEmpty)
            _buildBreadcrumb(context, browserState.currentPath, browserNotifier),
          // 文件类型筛选
          _buildFileTypeFilter(context, browserState, browserNotifier),
          // 内容区域
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => browserNotifier.refresh(),
              child: _buildBody(
                context,
                browserState,
                browserNotifier,
                viewMode.value,
                scrollController,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreadcrumb(
    BuildContext context,
    String path,
    FileBrowserNotifier notifier,
  ) {
    final parts = ['根目录', ...path.split('/')];

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: parts.length,
        separatorBuilder: (context, index) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Icon(
            Symbols.chevron_right,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        itemBuilder: (context, index) {
          final isLast = index == parts.length - 1;
          return InkWell(
            onTap: isLast
                ? null
                : () {
                    if (index == 0) {
                      notifier.loadDirectory(path: '');
                    } else {
                      final targetPath = parts
                          .sublist(1, index + 1)
                          .join('/');
                      notifier.loadDirectory(path: targetPath);
                    }
                  },
            child: Center(
              child: Text(
                parts[index],
                style: TextStyle(
                  color: isLast
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: isLast ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFileTypeFilter(
    BuildContext context,
    FileBrowserState state,
    FileBrowserNotifier notifier,
  ) {
    final filters = [
      {'filter': FileTypeFilter.all, 'label': '全部', 'icon': Symbols.folder_open},
      {'filter': FileTypeFilter.folder, 'label': '文件夹', 'icon': Symbols.folder},
      {'filter': FileTypeFilter.image, 'label': '图片', 'icon': Symbols.image},
      {'filter': FileTypeFilter.document, 'label': '文档', 'icon': Symbols.description},
      {'filter': FileTypeFilter.video, 'label': '视频', 'icon': Symbols.video_file},
      {'filter': FileTypeFilter.audio, 'label': '音频', 'icon': Symbols.audio_file},
      {'filter': FileTypeFilter.archive, 'label': '压缩包', 'icon': Symbols.folder_zip},
      {'filter': FileTypeFilter.text, 'label': '文本', 'icon': Symbols.text_snippet},
    ];

    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1,
          ),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final filterData = filters[index];
          final filter = filterData['filter'] as FileTypeFilter;
          final label = filterData['label'] as String;
          final icon = filterData['icon'] as IconData;
          final isSelected = state.fileTypeFilter == filter;

          return FilterChip(
            label: Text(label),
            avatar: Icon(icon, size: 18),
            selected: isSelected,
            onSelected: (selected) {
              notifier.setFileTypeFilter(filter);
            },
            showCheckmark: false,
          );
        },
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    FileBrowserState state,
    FileBrowserNotifier notifier,
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
              '此目录为空',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    final displayItems = state.filteredItems;

    // 本地搜索无结果
    if (state.isSearching && displayItems.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.search_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '未找到匹配的文件',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              '尝试使用其他关键词或使用全局搜索',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
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
        itemCount: displayItems.length + 1, // +1 for loading indicator
        separatorBuilder: (context, index) {
          if (index >= displayItems.length) return const SizedBox.shrink();
          return const Divider(height: 1);
        },
        itemBuilder: (context, index) {
          if (index >= displayItems.length) {
            // 底部加载指示器
            return _buildLoadingIndicator(context, state);
          }
          return _buildListItem(context, displayItems[index], notifier);
        },
      );
    } else {
      return GridView.builder(
        controller: scrollController,
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 0.85,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: displayItems.length + 1, // +1 for loading indicator
        itemBuilder: (context, index) {
          if (index >= displayItems.length) {
            // 底部加载指示器（占据整行）
            return _buildLoadingIndicator(context, state);
          }
          return _buildGridItem(context, displayItems[index], notifier);
        },
      );
    }
  }

  Widget _buildLoadingIndicator(BuildContext context, FileBrowserState state) {
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

  Widget _buildListItem(
    BuildContext context,
    FileItem item,
    FileBrowserNotifier notifier,
  ) {
    return ListTile(
      leading: Icon(
        _getFileIcon(item),
        size: 32,
        color: item.isFolder
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      title: Text(
        item.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        item.isFolder ? '文件夹' : '${item.getFormattedSize()} · ${item.getRelativeTime()}',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
      trailing: Icon(
        item.isFolder ? Symbols.chevron_right : Symbols.more_vert,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      onTap: () => _handleItemTap(context, item, notifier),
      onLongPress: item.isFile
          ? () => _showFileOptions(context, item)
          : null,
    );
  }

  Widget _buildGridItem(
    BuildContext context,
    FileItem item,
    FileBrowserNotifier notifier,
  ) {
    return Card(
      child: InkWell(
        onTap: () => _handleItemTap(context, item, notifier),
        onLongPress: item.isFile
            ? () => _showFileOptions(context, item)
            : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _getFileIcon(item),
                size: 48,
                color: item.isFolder
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: 8),
              Text(
                item.name,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (item.isFile) ...[
                const SizedBox(height: 4),
                Text(
                  item.getFormattedSize(),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 10,
                      ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _handleItemTap(
    BuildContext context,
    FileItem item,
    FileBrowserNotifier notifier,
  ) {
    if (item.isFolder) {
      notifier.enterDirectory(item.path);
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => DocumentDetailScreen(
            file: item,
            repositoryId: repository.id,
          ),
        ),
      );
    }
  }

  void _showFileOptions(BuildContext context, FileItem item) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Symbols.info),
              title: const Text('详情'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('文件详情功能开发中')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Symbols.download),
              title: const Text('下载'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('下载功能开发中')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Symbols.share),
              title: const Text('分享'),
              enabled: false,
              onTap: () {},
            ),
            ListTile(
              leading: const Icon(Symbols.content_copy),
              title: const Text('复制路径'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('已复制: ${item.path}')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  IconData _getFileIcon(FileItem item) {
    if (item.isFolder) return Symbols.folder;

    final ext = item.extension?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return Symbols.picture_as_pdf;
      case 'doc':
      case 'docx':
        return Symbols.description;
      case 'xls':
      case 'xlsx':
        return Symbols.table_chart;
      case 'ppt':
      case 'pptx':
        return Symbols.slideshow;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return Symbols.image;
      case 'mp4':
      case 'avi':
      case 'mov':
        return Symbols.video_file;
      case 'mp3':
      case 'wav':
        return Symbols.audio_file;
      case 'zip':
      case 'rar':
      case '7z':
        return Symbols.folder_zip;
      case 'txt':
      case 'md':
        return Symbols.text_snippet;
      default:
        return Symbols.insert_drive_file;
    }
  }

  void _showSortOptions(
    BuildContext context,
    FileBrowserState state,
    FileBrowserNotifier notifier,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Text(
                    '排序方式',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Icon(
                      state.sortOrder == SortOrder.ascending
                          ? Symbols.arrow_upward
                          : Symbols.arrow_downward,
                    ),
                    onPressed: () {
                      notifier.toggleSortOrder();
                    },
                    tooltip: state.sortOrder == SortOrder.ascending ? '升序' : '降序',
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Symbols.sort_by_alpha),
              title: const Text('按名称'),
              trailing: state.sortType == SortType.name
                  ? const Icon(Symbols.check)
                  : null,
              onTap: () {
                notifier.setSortType(SortType.name);
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Symbols.schedule),
              title: const Text('按修改时间'),
              trailing: state.sortType == SortType.date
                  ? const Icon(Symbols.check)
                  : null,
              onTap: () {
                notifier.setSortType(SortType.date);
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: const Icon(Symbols.data_usage),
              title: const Text('按大小'),
              trailing: state.sortType == SortType.size
                  ? const Icon(Symbols.check)
                  : null,
              onTap: () {
                notifier.setSortType(SortType.size);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}

enum ViewMode {
  list,
  grid,
}
