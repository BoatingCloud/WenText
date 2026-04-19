import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:open_filex/open_filex.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import '../models/archive_item.dart';
import '../services/archive_service.dart';
import '../../repository/providers/download_provider.dart';
import '../../repository/models/download_task.dart';
import '../../../core/network/api_client.dart';

/// 档案详情页
class ArchiveDetailScreen extends HookConsumerWidget {
  final String archiveId;

  const ArchiveDetailScreen({
    super.key,
    required this.archiveId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archiveDetail = useState<ArchiveItem?>(null);
    final isLoading = useState<bool>(true);
    final error = useState<String?>(null);

    // 加载档案详情
    useEffect(() {
      Future<void> loadDetail() async {
        isLoading.value = true;
        error.value = null;

        final service = ArchiveService();
        final result = await service.getArchiveDetail(archiveId);

        if (result.success && result.data != null) {
          archiveDetail.value = result.data;
        } else {
          error.value = result.message ?? '加载档案详情失败';
        }

        isLoading.value = false;
      }

      loadDetail();
      return null;
    }, [archiveId]);

    return Scaffold(
      appBar: AppBar(
        title: const Text('档案详情'),
        actions: [
          IconButton(
            icon: const Icon(Symbols.share),
            onPressed: () {
              // TODO: 实现分享功能
            },
            tooltip: '分享',
          ),
        ],
      ),
      body: _buildBody(context, archiveDetail.value, isLoading.value, error.value),
      bottomNavigationBar: archiveDetail.value != null
          ? _buildBottomBar(context, archiveDetail.value!)
          : null,
    );
  }

  Widget _buildBody(
    BuildContext context,
    ArchiveItem? archive,
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

    if (archive == null) {
      return const Center(child: Text('档案不存在'));
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 预览区域
          _buildPreviewSection(context, archive),

          // 基本信息
          _buildBasicInfoSection(context, archive),

          // 业务信息
          _buildBusinessInfoSection(context, archive),

          // 管理信息
          _buildManagementInfoSection(context, archive),

          // 附件列表
          if (archive.attachments != null && archive.attachments!.isNotEmpty)
            _buildAttachmentsSection(context, archive),

          const SizedBox(height: 80), // 底部按钮栏的空间
        ],
      ),
    );
  }

  Widget _buildPreviewSection(BuildContext context, ArchiveItem archive) {
    return Container(
      width: double.infinity,
      height: 200,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: archive.thumbnailUrl != null
          ? Image.network(
              archive.thumbnailUrl!,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return _buildPlaceholderPreview(context);
              },
            )
          : _buildPlaceholderPreview(context),
    );
  }

  Widget _buildPlaceholderPreview(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Symbols.folder,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 8),
          Text(
            '暂无预览',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildBasicInfoSection(BuildContext context, ArchiveItem archive) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 标题和状态
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  archive.name,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: archive.getStatusColor().withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  archive.getStatusText(),
                  style: TextStyle(
                    color: archive.getStatusColor(),
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 基本信息卡片
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '基本信息',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow(context, '档案编号', archive.archiveNumber),
                  if (archive.fondName != null)
                    _buildInfoRow(context, '全宗名称', archive.fondName!),
                  if (archive.category != null)
                    _buildInfoRow(context, '分类', archive.category!),
                  if (archive.year != null)
                    _buildInfoRow(context, '年度', archive.year!),
                  if (archive.responsiblePerson != null)
                    _buildInfoRow(context, '责任者', archive.responsiblePerson!),
                  if (archive.formationDate != null)
                    _buildInfoRow(context, '形成日期', archive.getFormattedFormationDate()),
                  if (archive.description != null)
                    _buildInfoRow(context, '描述', archive.description!, isLast: true),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBusinessInfoSection(BuildContext context, ArchiveItem archive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '业务信息',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 16),
              if (archive.securityLevel != null)
                _buildInfoRow(
                  context,
                  '密级',
                  archive.securityLevel!,
                  valueColor: archive.getSecurityLevelColor(),
                ),
              if (archive.retentionPeriod != null)
                _buildInfoRow(context, '保管期限', archive.retentionPeriod!),
              if (archive.department != null)
                _buildInfoRow(context, '移交部门', archive.department!),
              if (archive.fileNumber != null)
                _buildInfoRow(context, '文件编号', archive.fileNumber!),
              if (archive.pageCount != null)
                _buildInfoRow(context, '页数', '${archive.pageCount}页'),
              if (archive.copies != null)
                _buildInfoRow(context, '份数', '${archive.copies}份', isLast: true),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildManagementInfoSection(BuildContext context, ArchiveItem archive) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '管理信息',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 16),
              if (archive.location != null)
                _buildInfoRow(context, '存放位置', archive.location!),
              if (archive.workflowStatus != null)
                _buildInfoRow(context, '工作流状态', archive.workflowStatus!),
              if (archive.createdAt != null)
                _buildInfoRow(
                  context,
                  '创建时间',
                  _formatDateTime(archive.createdAt!),
                ),
              if (archive.updatedAt != null)
                _buildInfoRow(
                  context,
                  '更新时间',
                  _formatDateTime(archive.updatedAt!),
                  isLast: true,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAttachmentsSection(BuildContext context, ArchiveItem archive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    '附件列表',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const Spacer(),
                  Text(
                    '${archive.attachments!.length} 个附件',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              ...archive.attachments!.asMap().entries.map((entry) {
                final index = entry.key;
                final attachment = entry.value;
                final isLast = index == archive.attachments!.length - 1;

                return _AttachmentItem(
                  archiveId: archive.id,
                  attachment: attachment,
                  index: index,
                  isLast: isLast,
                );
              }),
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

  Widget _buildBottomBar(BuildContext context, ArchiveItem archive) {
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
            // 收藏按钮
            OutlinedButton.icon(
              onPressed: () {
                // TODO: 实现收藏功能
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('收藏功能开发中')),
                );
              },
              icon: const Icon(Symbols.star),
              label: const Text('收藏'),
            ),
            const SizedBox(width: 12),

            // 下载按钮
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  // TODO: 实现下载功能
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('下载功能开发中')),
                  );
                },
                icon: const Icon(Symbols.download),
                label: const Text('下载'),
              ),
            ),
            const SizedBox(width: 12),

            // 借阅按钮
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: archive.status == ArchiveStatus.inStorage
                    ? () {
                        _showBorrowDialog(context, archive);
                      }
                    : null,
                icon: const Icon(Symbols.book),
                label: Text(
                  archive.status == ArchiveStatus.borrowed ? '已借出' : '申请借阅',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showBorrowDialog(BuildContext context, ArchiveItem archive) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => BorrowRequestDialog(archiveId: archive.id),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}

/// 借阅申请对话框
class BorrowRequestDialog extends HookConsumerWidget {
  final String archiveId;

  const BorrowRequestDialog({
    super.key,
    required this.archiveId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final borrowerController = useTextEditingController();
    final remarkController = useTextEditingController();
    final borrowDate = useState<DateTime>(DateTime.now());
    final returnDate = useState<DateTime>(DateTime.now().add(const Duration(days: 30)));
    final isSubmitting = useState<bool>(false);

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '申请借阅',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 24),

            // 借阅人
            TextField(
              controller: borrowerController,
              decoration: const InputDecoration(
                labelText: '借阅人',
                hintText: '请输入借阅人姓名',
                prefixIcon: Icon(Symbols.person),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // 借阅日期
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Symbols.calendar_today),
              title: const Text('借阅日期'),
              subtitle: Text(_formatDate(borrowDate.value)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: borrowDate.value,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  borrowDate.value = picked;
                }
              },
            ),
            const Divider(),

            // 归还日期
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Symbols.event_available),
              title: const Text('归还日期'),
              subtitle: Text(_formatDate(returnDate.value)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: returnDate.value,
                  firstDate: borrowDate.value,
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  returnDate.value = picked;
                }
              },
            ),
            const Divider(),
            const SizedBox(height: 16),

            // 备注
            TextField(
              controller: remarkController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: '备注',
                hintText: '请输入借阅原因或备注信息',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),

            // 提交按钮
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: isSubmitting.value
                    ? null
                    : () async {
                        if (borrowerController.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('请输入借阅人姓名')),
                          );
                          return;
                        }

                        isSubmitting.value = true;

                        final service = ArchiveService();
                        final result = await service.createBorrowRequest(
                          archiveId: archiveId,
                          borrower: borrowerController.text.trim(),
                          borrowedAt: borrowDate.value,
                          dueAt: returnDate.value,
                          borrowRemark: remarkController.text.trim().isEmpty
                              ? null
                              : remarkController.text.trim(),
                        );

                        isSubmitting.value = false;

                        if (context.mounted) {
                          if (result.success) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(result.message ?? '借阅申请已提交')),
                            );
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(result.message ?? '提交失败'),
                                backgroundColor: Theme.of(context).colorScheme.error,
                              ),
                            );
                          }
                        }
                      },
                child: isSubmitting.value
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('提交申请'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}

/// 附件项组件
class _AttachmentItem extends HookConsumerWidget {
  final String archiveId;
  final String attachment;
  final int index;
  final bool isLast;

  const _AttachmentItem({
    required this.archiveId,
    required this.attachment,
    required this.index,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloadManager = ref.watch(downloadManagerProvider);
    final attachmentInfo = useState<Map<String, dynamic>?>(null);
    final isLoadingInfo = useState<bool>(false);

    // 加载附件信息
    useEffect(() {
      Future<void> loadAttachmentInfo() async {
        if (isLoadingInfo.value) return;
        isLoadingInfo.value = true;

        try {
          final dio = ApiClient().mainDio;
          final response = await dio.get('/physical-archives/$archiveId/attachments');

          if (response.statusCode == 200 && response.data['data'] is List) {
            final attachments = response.data['data'] as List;
            // 找到当前附件的信息
            final info = attachments.firstWhere(
              (a) => a['id'] == attachment,
              orElse: () => null,
            );
            attachmentInfo.value = info;
          }
        } catch (e) {
          print('加载附件信息失败: $e');
        } finally {
          isLoadingInfo.value = false;
        }
      }

      loadAttachmentInfo();
      return null;
    }, [attachment]);

    // 获取文件名
    final fileName = attachmentInfo.value?['fileName'] ?? attachment.split('/').last;
    final fileSize = attachmentInfo.value?['fileSize'];
    final fileId = '$archiveId-attachment-$attachment';

    // 检查下载状态
    final downloadTask = downloadManager.tasks[fileId];
    final isDownloading = downloadTask?.status == DownloadStatus.downloading;
    final isCompleted = downloadTask?.status == DownloadStatus.completed;
    final progress = downloadTask?.progress ?? 0.0;

    return Column(
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _getFileIcon(fileName),
              color: Theme.of(context).colorScheme.onPrimaryContainer,
              size: 20,
            ),
          ),
          title: Text(
            fileName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: isDownloading
              ? LinearProgressIndicator(value: progress)
              : (isCompleted
                  ? Text(
                      '已下载',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    )
                  : (fileSize != null
                      ? Text(_formatFileSize(int.tryParse(fileSize.toString()) ?? 0))
                      : null)),
          trailing: isDownloading
              ? IconButton(
                  icon: const Icon(Symbols.close),
                  onPressed: () {
                    ref.read(downloadManagerProvider.notifier).cancelDownload(fileId);
                  },
                  tooltip: '取消下载',
                )
              : (isCompleted
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Symbols.share),
                          onPressed: () => _shareFile(context, downloadTask!.savePath, fileName),
                          tooltip: '分享',
                        ),
                        IconButton(
                          icon: const Icon(Symbols.folder_open),
                          onPressed: () => _openFile(context, downloadTask!.savePath),
                          tooltip: '打开',
                        ),
                      ],
                    )
                  : IconButton(
                      icon: const Icon(Symbols.download),
                      onPressed: () => _downloadAttachment(context, ref, fileName),
                      tooltip: '下载',
                    )),
        ),
        if (!isLast) const Divider(),
      ],
    );
  }

  void _downloadAttachment(BuildContext context, WidgetRef ref, String fileName) {
    final fileId = '$archiveId-attachment-$attachment';

    // 构建附件下载 URL
    String downloadUrl;
    if (attachment.startsWith('http://') || attachment.startsWith('https://')) {
      // 完整的 HTTP URL
      downloadUrl = attachment;
    } else if (attachment.startsWith('/')) {
      // 已经是 API 路径
      downloadUrl = attachment;
    } else {
      // 文件 ID，使用档案附件下载端点
      // 格式: /physical-archives/{archiveId}/attachments/{attachmentId}/download
      downloadUrl = '/physical-archives/$archiveId/attachments/$attachment/download';
    }

    print('DownloadAttachment: attachment=$attachment, fileName=$fileName, downloadUrl=$downloadUrl');

    // 开始下载
    ref.read(downloadManagerProvider.notifier).startDownload(
          fileId: fileId,
          fileName: fileName,
          repositoryId: archiveId,
          customUrl: downloadUrl,
        );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('开始下载: $fileName')),
    );
  }

  /// 打开文件
  Future<void> _openFile(BuildContext context, String filePath) async {
    try {
      // 检查文件是否存在
      final file = File(filePath);
      if (!await file.exists()) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('文件不存在')),
          );
        }
        return;
      }

      // 使用 open_filex 打开文件
      final result = await OpenFilex.open(filePath);

      print('OpenFile: path=$filePath, result=${result.type}, message=${result.message}');

      // 处理打开结果
      if (context.mounted) {
        switch (result.type) {
          case ResultType.done:
            // 成功打开，不显示提示
            break;
          case ResultType.noAppToOpen:
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('没有可以打开此文件的应用')),
            );
            break;
          case ResultType.fileNotFound:
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('文件不存在')),
            );
            break;
          case ResultType.permissionDenied:
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('没有权限打开文件')),
            );
            break;
          case ResultType.error:
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('打开文件失败: ${result.message}')),
            );
            break;
        }
      }
    } catch (e) {
      print('OpenFile error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('打开文件失败: $e')),
        );
      }
    }
  }

  /// 分享文件
  Future<void> _shareFile(BuildContext context, String filePath, String fileName) async {
    try {
      // 检查文件是否存在
      final file = File(filePath);
      if (!await file.exists()) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('文件不存在')),
          );
        }
        return;
      }

      // 使用 share_plus 分享文件
      final xFile = XFile(filePath, name: fileName);
      await Share.shareXFiles(
        [xFile],
        text: '分享文件: $fileName',
      );

      print('ShareFile: path=$filePath, fileName=$fileName');
    } catch (e) {
      print('ShareFile error: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('分享文件失败: $e')),
        );
      }
    }
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  IconData _getFileIcon(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
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
        return Symbols.image;
      case 'zip':
      case 'rar':
      case '7z':
        return Symbols.folder_zip;
      default:
        return Symbols.attach_file;
    }
  }
}

