import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../archive/models/archive_item.dart';
import '../../archive/screens/archive_detail_screen.dart';
import '../providers/search_provider.dart';
import '../widgets/advanced_search_panel.dart';

/// 搜索结果页面
class SearchResultsScreen extends HookConsumerWidget {
  final String query;

  const SearchResultsScreen({super.key, required this.query});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchState = ref.watch(searchResultProvider);
    final searchNotifier = ref.read(searchResultProvider.notifier);
    final searchController = useTextEditingController(text: query);
    final scrollController = useScrollController();

    // 初始化搜索
    useEffect(() {
      Future.microtask(() => searchNotifier.search(query));
      return null;
    }, [query]);

    // 滚动加载更多
    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          if (searchState.hasMore && !searchState.isLoading) {
            searchNotifier.loadMore();
          }
        }
      }
      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [searchState.hasMore, searchState.isLoading]);

    void performSearch(String keyword) {
      if (keyword.trim().isEmpty) return;
      searchNotifier.search(keyword.trim());
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: searchController,
          decoration: const InputDecoration(
            hintText: '搜索文档、档案...',
            border: InputBorder.none,
            contentPadding: EdgeInsets.symmetric(vertical: 12),
          ),
          onSubmitted: (value) => performSearch(value),
        ),
        actions: [
          // 高级搜索筛选按钮
          IconButton(
            icon: Badge(
              isLabelVisible: searchState.hasFilters,
              child: const Icon(Symbols.tune),
            ),
            onPressed: () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                builder: (context) => AdvancedSearchPanel(
                  selectedCategoryId: searchState.categoryId,
                  selectedYear: searchState.year,
                  selectedStatus: searchState.status,
                  onApply: ({categoryId, year, status}) {
                    searchNotifier.applyFilters(
                      categoryId: categoryId,
                      year: year,
                      status: status,
                    );
                  },
                  onClear: () => searchNotifier.clearFilters(),
                ),
              );
            },
            tooltip: '高级搜索',
          ),
          TextButton(
            onPressed: () => performSearch(searchController.text),
            child: const Text('搜索'),
          ),
        ],
      ),
      body: _buildBody(context, searchState, searchNotifier, scrollController),
    );
  }

  Widget _buildBody(
    BuildContext context,
    SearchResultState state,
    SearchResultNotifier notifier,
    ScrollController scrollController,
  ) {
    if (state.isLoading && state.archiveResults.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.archiveResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Symbols.error, size: 64,
                color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 16),
            Text(state.error!,
                style: Theme.of(context).textTheme.bodyLarge,
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => notifier.search(state.query),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.archiveResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Symbols.search_off, size: 64,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text('未找到相关结果',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    )),
            const SizedBox(height: 8),
            Text('尝试使用其他关键词搜索',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    )),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 结果统计
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Text(
            '找到 ${state.archiveResults.length} 条档案结果',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
        // 结果列表
        Expanded(
          child: ListView.separated(
            controller: scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: state.archiveResults.length + 1,
            separatorBuilder: (_, index) {
              if (index >= state.archiveResults.length) {
                return const SizedBox.shrink();
              }
              return const SizedBox(height: 8);
            },
            itemBuilder: (context, index) {
              if (index >= state.archiveResults.length) {
                return _buildLoadMore(context, state);
              }
              return _buildResultItem(context, state.archiveResults[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildResultItem(BuildContext context, ArchiveItem item) {
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
          child: Row(
            children: [
              // 图标
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Symbols.folder,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(width: 12),
              // 内容
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '编号: ${item.archiveNumber}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color:
                                item.getStatusColor().withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item.getStatusText(),
                            style: TextStyle(
                              color: item.getStatusColor(),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        if (item.year != null) ...[
                          const SizedBox(width: 8),
                          Text(
                            item.year!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Symbols.chevron_right,
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadMore(BuildContext context, SearchResultState state) {
    if (state.isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    } else if (!state.hasMore && state.archiveResults.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Text(
            '没有更多结果了',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}