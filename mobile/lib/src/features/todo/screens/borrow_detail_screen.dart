import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/borrow_record.dart';
import '../services/todo_service.dart';
import '../../archive/screens/archive_detail_screen.dart';

/// 借阅详情页
class BorrowDetailScreen extends HookConsumerWidget {
  final String borrowId;
  final BorrowRecord? borrowRecord; // 可选的借阅记录，如果提供则不需要重新加载

  const BorrowDetailScreen({
    super.key,
    required this.borrowId,
    this.borrowRecord,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final borrow = useState<BorrowRecord?>(borrowRecord); // 使用传入的数据初始化
    final isLoading = useState<bool>(borrowRecord == null); // 如果有数据则不需要加载
    final error = useState<String?>(null);

    // 加载详情（仅在没有传入数据时）
    useEffect(() {
      if (borrowRecord != null) {
        // 已有数据，不需要加载
        return null;
      }

      Future<void> loadDetail() async {
        isLoading.value = true;
        error.value = null;

        final service = TodoService();
        final result = await service.getBorrowDetail(borrowId);

        if (result.success && result.data != null) {
          borrow.value = result.data;
        } else {
          error.value = result.message ?? '加载失败';
        }

        isLoading.value = false;
      }

      loadDetail();
      return null;
    }, [borrowId]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('借阅详情'),
      ),
      body: _buildBody(context, borrow.value, isLoading.value, error.value),
      bottomNavigationBar: borrow.value != null &&
              borrow.value!.status == BorrowStatus.borrowing
          ? _buildBottomBar(context, borrow.value!)
          : null,
    );
  }

  Widget _buildBody(
    BuildContext context,
    BorrowRecord? borrow,
    bool isLoading,
    String? error,
  ) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (error != null) {
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
              error,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    if (borrow == null) {
      return const Center(child: Text('借阅记录不存在'));
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 借阅信息卡片
          _buildBorrowInfoCard(context, borrow),

          const SizedBox(height: 80), // 底部按钮栏的空间
        ],
      ),
    );
  }

  Widget _buildBorrowInfoCard(BuildContext context, BorrowRecord borrow) {
    final isOverdue = borrow.isOverdue;

    return Container(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 标题
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Symbols.book,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '借阅详情',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: borrow.getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      borrow.getStatusText(),
                      style: TextStyle(
                        color: borrow.getStatusColor(),
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),

              // 档案信息
              Text(
                '档案信息',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          ArchiveDetailScreen(archiveId: borrow.archiveId),
                    ),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Symbols.folder,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              borrow.archiveName,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                            if (borrow.archiveNumber != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                borrow.archiveNumber!,
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
                      ),
                      Icon(
                        Symbols.chevron_right,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 借阅信息
              _buildInfoRow(
                  context, '借阅时间', borrow.formatDateTime(borrow.borrowedAt)),
              _buildInfoRow(
                context,
                '应还时间',
                borrow.formatDateTime(borrow.dueAt),
                valueColor: isOverdue ? Theme.of(context).colorScheme.error : null,
              ),
              if (borrow.returnedAt != null)
                _buildInfoRow(context, '实际归还时间',
                    borrow.formatDateTime(borrow.returnedAt!)),

              // 续借信息
              _buildInfoRow(
                  context, '续借次数', '${borrow.renewCount}/${borrow.maxRenewCount}'),

              // 借阅事由
              if (borrow.borrowRemark != null && borrow.borrowRemark!.isNotEmpty)
                _buildInfoRow(context, '借阅事由', borrow.borrowRemark!),

              // 归还备注
              if (borrow.returnRemark != null && borrow.returnRemark!.isNotEmpty)
                _buildInfoRow(context, '归还备注', borrow.returnRemark!, isLast: true),

              // 逾期提示
              if (isOverdue) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Symbols.warning,
                        color: Theme.of(context).colorScheme.error,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '已逾期 ${-borrow.remainingDays} 天，请尽快归还',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // 即将到期提示
              if (!isOverdue &&
                  borrow.status == BorrowStatus.borrowing &&
                  borrow.remainingDays <= 7) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.orange.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Colors.orange,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Symbols.schedule,
                        color: Colors.orange,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '还剩 ${borrow.remainingDays} 天到期',
                          style: const TextStyle(
                            color: Colors.orange,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context,
    String label,
    String value, {
    Color? valueColor,
    bool isLast = false,
  }) {
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 100,
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: valueColor,
                      fontWeight: valueColor != null ? FontWeight.bold : null,
                    ),
              ),
            ),
          ],
        ),
        if (!isLast) const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildBottomBar(BuildContext context, BorrowRecord borrow) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // 续借按钮
            if (borrow.canRenew)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showRenewDialog(context, borrow),
                  icon: const Icon(Symbols.update),
                  label: const Text('续借'),
                ),
              ),
            if (borrow.canRenew) const SizedBox(width: 12),

            // 归还按钮
            Expanded(
              flex: borrow.canRenew ? 2 : 1,
              child: FilledButton.icon(
                onPressed: () => _showReturnDialog(context, borrow),
                icon: const Icon(Symbols.assignment_return),
                label: const Text('归还'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRenewDialog(BuildContext context, BorrowRecord borrow) {
    final daysController = TextEditingController(text: '30');
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('续借申请'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: daysController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '续借天数',
                hintText: '请输入续借天数',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: '续借事由',
                hintText: '请输入续借事由（可选）',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              final days = int.tryParse(daysController.text.trim());
              if (days == null || days <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('请输入有效的天数')),
                );
                return;
              }

              Navigator.pop(context);

              final service = TodoService();
              final result = await service.renewBorrow(
                borrowId: borrow.archiveId,
                days: days,
                reason: reasonController.text.trim().isEmpty
                    ? null
                    : reasonController.text.trim(),
              );

              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(result.message ?? '续借申请已提交'),
                    backgroundColor: result.success
                        ? null
                        : Theme.of(context).colorScheme.error,
                  ),
                );

                if (result.success) {
                  Navigator.pop(context, true);
                }
              }
            },
            child: const Text('提交'),
          ),
        ],
      ),
    );
  }

  void _showReturnDialog(BuildContext context, BorrowRecord borrow) {
    final remarkController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('归还档案'),
        content: TextField(
          controller: remarkController,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: '归还备注',
            hintText: '请输入归还备注（可选）',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);

              final service = TodoService();
              final result = await service.returnBorrow(
                borrowId: borrow.archiveId,
                remark: remarkController.text.trim().isEmpty
                    ? null
                    : remarkController.text.trim(),
              );

              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(result.message ?? '归还成功'),
                    backgroundColor: result.success
                        ? null
                        : Theme.of(context).colorScheme.error,
                  ),
                );

                if (result.success) {
                  Navigator.pop(context, true);
                }
              }
            },
            child: const Text('确认归还'),
          ),
        ],
      ),
    );
  }
}
