import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../providers/archive_list_provider.dart';
import '../services/archive_service.dart';

/// 档案筛选面板
class ArchiveFilterPanel extends HookConsumerWidget {
  const ArchiveFilterPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archiveState = ref.watch(archiveListProvider);
    final archiveNotifier = ref.read(archiveListProvider.notifier);

    // 本地筛选状态
    final selectedYear = useState<String?>(archiveState.year);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 顶部标题栏
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                Text(
                  '筛选条件',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () {
                    selectedYear.value = null;
                  },
                  child: const Text('重置'),
                ),
              ],
            ),
          ),

          // 筛选选项列表
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 年度筛选
                  _buildSectionTitle(context, '年度'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _getYearOptions().map((year) {
                      final isSelected = selectedYear.value == year;
                      return FilterChip(
                        label: Text(year),
                        selected: isSelected,
                        onSelected: (selected) {
                          selectedYear.value = selected ? year : null;
                        },
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),

          // 底部按钮
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      archiveNotifier.clearFilters();
                      Navigator.pop(context);
                    },
                    child: const Text('清除筛选'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: () {
                      archiveNotifier.applyFilters(
                        year: selectedYear.value,
                      );
                      Navigator.pop(context);
                    },
                    child: const Text('确认筛选'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
    );
  }

  List<String> _getYearOptions() {
    final currentYear = DateTime.now().year;
    return List.generate(10, (index) => (currentYear - index).toString());
  }
}
