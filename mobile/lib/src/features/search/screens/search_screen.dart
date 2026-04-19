import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../providers/search_provider.dart';
import 'search_results_screen.dart';

/// 搜索中心页面
class SearchScreen extends HookConsumerWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchController = useTextEditingController();
    final searchHistory = ref.watch(searchHistoryProvider);
    final historyNotifier = ref.read(searchHistoryProvider.notifier);
    final focusNode = useFocusNode();

    final hotSearches = ['档案管理', '借阅申请', '归档流程', '文书档案', '人事档案', '会计档案'];

    void performSearch(String keyword) {
      if (keyword.trim().isEmpty) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => SearchResultsScreen(query: keyword.trim()),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: searchController,
          focusNode: focusNode,
          autofocus: true,
          decoration: InputDecoration(
            hintText: '搜索文档、档案...',
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
            prefixIcon: const Icon(Symbols.search, size: 22),
            suffixIcon: searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Symbols.close, size: 20),
                    onPressed: () {
                      searchController.clear();
                    },
                  )
                : null,
          ),
          onSubmitted: (value) => performSearch(value),
        ),
        actions: [
          TextButton(
            onPressed: () => performSearch(searchController.text),
            child: const Text('搜索'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 搜索历史
          if (searchHistory.isNotEmpty) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '搜索历史',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                TextButton(
                  onPressed: () => historyNotifier.clearHistory(),
                  child: const Text('清空'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: searchHistory.map((keyword) {
                return InputChip(
                  label: Text(keyword),
                  onPressed: () => performSearch(keyword),
                  onDeleted: () => historyNotifier.removeHistory(keyword),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
          ],

          // 热门搜索
          Text(
            '热门搜索',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: hotSearches.asMap().entries.map((entry) {
              final index = entry.key;
              final keyword = entry.value;
              return ActionChip(
                avatar: CircleAvatar(
                  radius: 12,
                  backgroundColor: index < 3
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: Text(
                    '${index + 1}',
                    style: TextStyle(
                      color: index < 3
                          ? Theme.of(context).colorScheme.onPrimary
                          : Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 12,
                    ),
                  ),
                ),
                label: Text(keyword),
                onPressed: () => performSearch(keyword),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          // 搜索提示
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Symbols.lightbulb,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '搜索技巧',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildTip(context, '支持档案名称、编号、描述搜索'),
                  _buildTip(context, '使用空格分隔多个关键词'),
                  _buildTip(context, '支持按分类、年度、状态筛选'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTip(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '- ',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
