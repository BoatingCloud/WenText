import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

/// 高级搜索筛选面板
class AdvancedSearchPanel extends HookWidget {
  final String? selectedCategoryId;
  final String? selectedYear;
  final String? selectedStatus;
  final void Function({
    String? categoryId,
    String? year,
    String? status,
  }) onApply;
  final VoidCallback onClear;

  const AdvancedSearchPanel({
    super.key,
    this.selectedCategoryId,
    this.selectedYear,
    this.selectedStatus,
    required this.onApply,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final categoryId = useState<String?>(selectedCategoryId);
    final year = useState<String?>(selectedYear);
    final status = useState<String?>(selectedStatus);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 标题栏
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
            ),
            child: Row(
              children: [
                Text(
                  '高级搜索',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () {
                    categoryId.value = null;
                    year.value = null;
                    status.value = null;
                  },
                  child: const Text('重置'),
                ),
              ],
            ),
          ),

          // 筛选选项
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 年度
                  _buildSectionTitle(context, '年度'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _getYearOptions().map((y) {
                      return FilterChip(
                        label: Text(y),
                        selected: year.value == y,
                        onSelected: (s) => year.value = s ? y : null,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 状态
                  _buildSectionTitle(context, '状态'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _getStatusOptions().map((s) {
                      return FilterChip(
                        label: Text(s['label']!),
                        selected: status.value == s['value'],
                        onSelected: (sel) =>
                            status.value = sel ? s['value'] : null,
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
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      onClear();
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
                      onApply(
                        categoryId: categoryId.value,
                        year: year.value,
                        status: status.value,
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

  List<Map<String, String>> _getStatusOptions() {
    return [
      {'label': '在库', 'value': 'IN_STORAGE'},
      {'label': '借出', 'value': 'BORROWED'},
      {'label': '已销毁', 'value': 'DESTROYED'},
    ];
  }
}
