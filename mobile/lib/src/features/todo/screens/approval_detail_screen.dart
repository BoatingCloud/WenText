import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:signature/signature.dart';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import '../models/approval_request.dart';
import '../models/approval_history.dart';
import '../services/todo_service.dart';
import '../../archive/screens/archive_detail_screen.dart';

/// 审批详情页
class ApprovalDetailScreen extends HookConsumerWidget {
  final String requestId;

  const ApprovalDetailScreen({
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
        title: const Text('审批详情'),
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

              // 申请人信息
              _buildInfoRow(context, '申请人', request.applicantName),
              if (request.applicantDepartment != null)
                _buildInfoRow(context, '部门', request.applicantDepartment!),
              _buildInfoRow(
                  context, '申请时间', request.formatDateTime(request.createdAt)),

              // 借阅相关信息
              if (request.borrowedAt != null)
                _buildInfoRow(
                    context, '借阅时间', request.formatDateTime(request.borrowedAt!)),
              if (request.dueAt != null)
                _buildInfoRow(
                    context, '应还时间', request.formatDateTime(request.dueAt!)),

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
                  // 节点名称（如果有）
                  if (item.nodeName != null) ...[
                    Text(
                      item.nodeName!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.w500,
                          ),
                    ),
                    const SizedBox(height: 4),
                  ],
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
                              color: item.action.toUpperCase() == 'APPROVE'
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
                  // 显示签名图片
                  if (item.signatureUrl != null && item.signatureUrl!.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '电子签名：',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Image.network(
                            item.signatureUrl!,
                            height: 60,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return Text(
                                '签名加载失败',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Theme.of(context).colorScheme.error,
                                    ),
                              );
                            },
                          ),
                        ],
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
        child: Row(
          children: [
            // 驳回按钮
            Expanded(
              child: OutlinedButton.icon(
                onPressed: isSubmitting.value
                    ? null
                    : () => _showRejectDialog(context, request, isSubmitting),
                icon: const Icon(Symbols.close),
                label: const Text('驳回'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                  side: BorderSide(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // 通过按钮
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: isSubmitting.value
                    ? null
                    : () => _showApproveDialog(context, request, isSubmitting),
                icon: const Icon(Symbols.check),
                label: const Text('通过'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRejectDialog(
    BuildContext context,
    ApprovalRequest request,
    ValueNotifier<bool> isSubmitting,
  ) {
    final commentController = TextEditingController();
    final signatureController = SignatureController(
      penStrokeWidth: 3,
      penColor: Colors.black,
      exportBackgroundColor: Colors.white,
    );

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Dialog(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.9,
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.8,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 标题
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '驳回申请',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                const Divider(height: 1),
                // 内容
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: commentController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: '驳回理由',
                            hintText: '请输入驳回理由（必填）',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '电子签名（必填）',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Signature(
                            controller: signatureController,
                            backgroundColor: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              onPressed: () {
                                signatureController.clear();
                                setState(() {});
                              },
                              icon: const Icon(Symbols.refresh, size: 16),
                              label: const Text('清除重签'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1),
                // 按钮
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('取消'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () async {
                          if (commentController.text.trim().isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('请输入驳回理由')),
                            );
                            return;
                          }

                          if (signatureController.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('请签名')),
                            );
                            return;
                          }

                          Navigator.pop(context);

                          // 上传签名
                          final signatureUrl = await _uploadSignature(context, signatureController);
                          if (signatureUrl == null) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('签名上传失败，请重试')),
                              );
                            }
                            return;
                          }

                          await _rejectRequest(
                            context,
                            request,
                            commentController.text.trim(),
                            signatureUrl,
                            isSubmitting,
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: Theme.of(context).colorScheme.error,
                        ),
                        child: const Text('确认驳回'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ).then((_) {
      signatureController.dispose();
    });
  }

  void _showApproveDialog(
    BuildContext context,
    ApprovalRequest request,
    ValueNotifier<bool> isSubmitting,
  ) {
    final commentController = TextEditingController();
    final signatureController = SignatureController(
      penStrokeWidth: 3,
      penColor: Colors.black,
      exportBackgroundColor: Colors.white,
    );

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => Dialog(
          child: Container(
            width: MediaQuery.of(context).size.width * 0.9,
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.8,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 标题
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '审批通过',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                const Divider(height: 1),
                // 内容
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: commentController,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            labelText: '审批意见',
                            hintText: '请输入审批意见（可选）',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '电子签名（必填）',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Signature(
                            controller: signatureController,
                            backgroundColor: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              onPressed: () {
                                signatureController.clear();
                                setState(() {});
                              },
                              icon: const Icon(Symbols.refresh, size: 16),
                              label: const Text('清除重签'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 1),
                // 按钮
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('取消'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () async {
                          if (signatureController.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('请签名')),
                            );
                            return;
                          }

                          Navigator.pop(context);

                          // 上传签名
                          final signatureUrl = await _uploadSignature(context, signatureController);
                          if (signatureUrl == null) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('签名上传失败，请重试')),
                              );
                            }
                            return;
                          }

                          await _approveRequest(
                            context,
                            request,
                            commentController.text.trim().isEmpty
                                ? null
                                : commentController.text.trim(),
                            signatureUrl,
                            isSubmitting,
                          );
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.green,
                        ),
                        child: const Text('确认通过'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ).then((_) {
      signatureController.dispose();
    });
  }

  Future<String?> _uploadSignature(
    BuildContext context,
    SignatureController signatureController,
  ) async {
    try {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('正在上传签名...')),
        );
      }

      // 将签名转换为图片
      final Uint8List? signatureBytes = await signatureController.toPngBytes();
      if (signatureBytes == null) {
        return null;
      }

      // 保存到临时文件
      final tempDir = await getTemporaryDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final file = File('${tempDir.path}/signature_$timestamp.png');
      await file.writeAsBytes(signatureBytes);

      // 上传签名
      final service = TodoService();
      final result = await service.uploadSignature(file.path);

      // 删除临时文件
      await file.delete();

      if (result.success && result.data != null) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result.message ?? '签名上传成功')),
          );
        }
        return result.data!['url'] as String?;
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.message ?? '签名上传失败'),
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
          );
        }
        return null;
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('签名上传失败: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
      return null;
    }
  }

  Future<void> _approveRequest(
    BuildContext context,
    ApprovalRequest request,
    String? comment,
    String? signatureUrl,
    ValueNotifier<bool> isSubmitting,
  ) async {
    isSubmitting.value = true;

    final service = TodoService();
    final result = await service.approveRequest(
      requestId: request.id,
      comment: comment,
      signatureUrl: signatureUrl,
    );

    isSubmitting.value = false;

    if (context.mounted) {
      if (result.success) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message ?? '审批通过')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message ?? '审批失败'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _rejectRequest(
    BuildContext context,
    ApprovalRequest request,
    String comment,
    String? signatureUrl,
    ValueNotifier<bool> isSubmitting,
  ) async {
    isSubmitting.value = true;

    final service = TodoService();
    final result = await service.rejectRequest(
      requestId: request.id,
      comment: comment,
      signatureUrl: signatureUrl,
    );

    isSubmitting.value = false;

    if (context.mounted) {
      if (result.success) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message ?? '已驳回')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message ?? '驳回失败'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }
}
