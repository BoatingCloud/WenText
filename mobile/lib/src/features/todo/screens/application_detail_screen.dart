import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/approval_request.dart';
import '../models/approval_history.dart';
import '../services/todo_service.dart';
import '../../archive/screens/archive_detail_screen.dart';

/// 申请详情页（我的申请）
class ApplicationDetailScreen extends HookConsumerWidget {
  final String requestId;

  const ApplicationDetailScreen({
    super.key,
    required this.requestId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = useState<ApprovalRequest?>(null);
    final history = useState<List<ApprovalHistory>>([]);
    final isLoading = useState<bool>(true);
    final error = useState<String?>(null);
    final isSubmitting = useState<bool>(false);

    // 加载详情
    useEffect(() {
      Future<void> loadDetail() async {
        isLoading.value = true;
        error.value = null;

        final service = TodoService();
        final requestResult = await service.getApprovalDetail(requestId);
        final historyResult = await service.getApprovalHistory(requestId);

        if (requestResult.success && requestResult.data != null) {
          request.value = requestResult.data;
        } else {
          error.value = requestResult.message ?? '加载失败';
        }

        if (historyResult.success && historyResult.data != null) {
          history.value = historyResult.data!;
        }

        isLoading.value = false;
      }

      loadDetail();
      return null;
    }, [requestId]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('申请详情'),
      ),
      body: _buildBody(
        context,
        request.value,
        history.value,
        isLoading.value,
        error.value,
      ),
      bottomNavigationBar: request.value != null &&
              request.value!.status == ApprovalStatus.pending
          ? _buildBottomBar(context, request.value!, isSubmitting)
          : null,
    );
  }

  Widget _buildBody(
    BuildContext context,
    ApprovalRequest? request,
    List<ApprovalHistory> history,
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

    if (request == null) {
      return const Center(child: Text('申请不存在'));
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 申请信息卡片
          _buildRequestInfoCard(context, request),

          // 审批历史
          if (history.isNotEmpty) _buildHistorySection(context, history),

          const SizedBox(height: 80), // 底部按钮栏的空间
        ],
      ),
    );
  }

  Widget _buildRequestInfoCard(BuildContext context, ApprovalRequest request) {
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
                      request.getTypeIcon(),
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      request.getTypeText(),
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
                      color: request.getStatusColor().withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      request.getStatusText(),
                      style: TextStyle(
                        color: request.getStatusColor(),
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
                          ArchiveDetailScreen(archiveId: request.archiveId),
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
                              request.archiveName,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                            if (request.archiveNumber != null) ...[
                              const SizedBox(height: 4),
                              Text(
                                request.archiveNumber!,
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

              // 申请信息
              _buildInfoRow(
                  context, '申请时间', request.formatDateTime(request.createdAt)),

              // 借阅相关信息
              if (request.borrowedAt != null)
                _buildInfoRow(
                    context, '借阅时间', request.formatDateTime(request.borrowedAt!)),
              if (request.dueAt != null)
                _buildInfoRow(
                    context, '应还时间', request.formatDateTime(request.dueAt!)),

              // 当前审批人
              if (request.status == ApprovalStatus.pending &&
                  request.currentApproverName != null)
                _buildInfoRow(context, '当前审批人', request.currentApproverName!),

              // 申请事由
              if (request.reason.isNotEmpty) ...[
                const SizedBox(height: 8),
                _buildInfoRow(context, '申请事由', request.reason, isLast: true),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHistorySection(
      BuildContext context, List<ApprovalHistory> history) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '审批历史',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 16),
              ...history.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;
                final isLast = index == history.length - 1;

                return _buildHistoryItem(context, item, isLast);
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHistoryItem(
      BuildContext context, ApprovalHistory item, bool isLast) {
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Symbols.person,
                size: 16,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        item.approverName,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item.getActionText(),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: item.action.toUpperCase() == 'APPROVED'
                                  ? Colors.green
                                  : Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.formatDateTime(item.createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  if (item.comment != null && item.comment!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.comment!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        if (!isLast) const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildInfoRow(
    BuildContext context,
    String label,
    String value, {
    bool isLast = false,
  }) {
    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 80,
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
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
        if (!isLast) const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildBottomBar(
    BuildContext context,
    ApprovalRequest request,
    ValueNotifier<bool> isSubmitting,
  ) {
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
        child: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: isSubmitting.value
                ? null
                : () => _cancelRequest(context, request, isSubmitting),
            icon: const Icon(Symbols.close),
            label: const Text('取消申请'),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _cancelRequest(
    BuildContext context,
    ApprovalRequest request,
    ValueNotifier<bool> isSubmitting,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('取消申请'),
        content: const Text('确定要取消这个申请吗？'),
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
            child: const Text('确认'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    isSubmitting.value = true;

    final service = TodoService();
    final result = await service.cancelRequest(request.id);

    isSubmitting.value = false;

    if (context.mounted) {
      if (result.success) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message ?? '已取消')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message ?? '取消失败'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}
