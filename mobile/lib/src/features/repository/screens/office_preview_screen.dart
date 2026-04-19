import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:open_filex/open_filex.dart';
import '../providers/download_provider.dart';
import '../models/download_task.dart';

/// Office文件预览页面
/// 提供下载功能，下载后可使用本地应用打开
class OfficePreviewScreen extends ConsumerStatefulWidget {
  final String fileUrl;
  final String fileId;
  final String repositoryId;
  final String title;
  final String fileExtension;

  const OfficePreviewScreen({
    super.key,
    required this.fileUrl,
    required this.fileId,
    required this.repositoryId,
    required this.title,
    required this.fileExtension,
  });

  @override
  ConsumerState<OfficePreviewScreen> createState() => _OfficePreviewScreenState();
}

class _OfficePreviewScreenState extends ConsumerState<OfficePreviewScreen> {
  @override
  Widget build(BuildContext context) {
    final downloadState = ref.watch(downloadManagerProvider);
    final downloadNotifier = ref.read(downloadManagerProvider.notifier);
    final downloadTask = downloadState.tasks[widget.fileId];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Office 图标
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  _getOfficeIcon(),
                  size: 64,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
              const SizedBox(height: 32),
              Text(
                widget.title,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              Text(
                _getFileTypeDescription(),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 48),

              // 下载进度卡片
              if (downloadTask != null && downloadTask.status == DownloadStatus.downloading)
                _buildDownloadProgress(context, downloadTask),

              if (downloadTask == null || downloadTask.status != DownloadStatus.downloading)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Icon(
                          Symbols.info,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Office 文件预览',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          downloadTask?.status == DownloadStatus.completed
                              ? '文件已下载完成，点击下方按钮打开文件。'
                              : 'Office 文件需要下载后使用本地应用打开查看。\n\n点击下方的下载按钮保存文件到本地。',
                          style: Theme.of(context).textTheme.bodySmall,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 32),

              // 操作按钮
              SizedBox(
                width: double.infinity,
                child: _buildActionButton(
                  context,
                  downloadTask,
                  downloadNotifier,
                ),
              ),

              if (downloadTask?.status == DownloadStatus.failed) ...[
                const SizedBox(height: 12),
                Text(
                  downloadTask!.error ?? '下载失败',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                  textAlign: TextAlign.center,
                ),
              ],

              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Symbols.arrow_back),
                  label: const Text('返回'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDownloadProgress(BuildContext context, DownloadTask task) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '正在下载',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  '${(task.progress * 100).toStringAsFixed(0)}%',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: task.progress,
              backgroundColor: Theme.of(context).colorScheme.surfaceVariant,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(
    BuildContext context,
    DownloadTask? downloadTask,
    DownloadManagerNotifier downloadNotifier,
  ) {
    if (downloadTask != null) {
      switch (downloadTask.status) {
        case DownloadStatus.downloading:
          return ElevatedButton.icon(
            onPressed: () {
              downloadNotifier.cancelDownload(widget.fileId);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('已取消下载')),
              );
            },
            icon: const Icon(Symbols.close),
            label: const Text('取消下载'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
          );

        case DownloadStatus.completed:
          return FilledButton.icon(
            onPressed: () => _openFile(downloadTask.savePath),
            icon: const Icon(Symbols.folder_open),
            label: const Text('打开文件'),
          );

        case DownloadStatus.failed:
        case DownloadStatus.cancelled:
          return ElevatedButton.icon(
            onPressed: () => _startDownload(downloadNotifier),
            icon: const Icon(Symbols.refresh),
            label: const Text('重试下载'),
          );

        default:
          break;
      }
    }

    return FilledButton.icon(
      onPressed: () => _startDownload(downloadNotifier),
      icon: const Icon(Symbols.download),
      label: const Text('下载文件'),
    );
  }

  void _startDownload(DownloadManagerNotifier downloadNotifier) {
    downloadNotifier.startDownload(
      fileId: widget.fileId,
      fileName: widget.title,
      repositoryId: widget.repositoryId,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('开始下载: ${widget.title}')),
    );
  }

  Future<void> _openFile(String filePath) async {
    if (filePath.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('文件路径无效')),
      );
      return;
    }

    try {
      final result = await OpenFilex.open(filePath);

      if (result.type != ResultType.done) {
        String message = '无法打开文件';
        switch (result.type) {
          case ResultType.noAppToOpen:
            message = '没有找到可以打开此文件的应用';
            break;
          case ResultType.fileNotFound:
            message = '文件不存在';
            break;
          case ResultType.permissionDenied:
            message = '没有权限打开文件';
            break;
          default:
            message = result.message;
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message)),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('打开文件失败: $e')),
        );
      }
    }
  }

  IconData _getOfficeIcon() {
    switch (widget.fileExtension.toLowerCase()) {
      case 'doc':
      case 'docx':
        return Symbols.description;
      case 'xls':
      case 'xlsx':
        return Symbols.table_chart;
      case 'ppt':
      case 'pptx':
        return Symbols.slideshow;
      default:
        return Symbols.insert_drive_file;
    }
  }

  String _getFileTypeDescription() {
    switch (widget.fileExtension.toLowerCase()) {
      case 'doc':
      case 'docx':
        return 'Microsoft Word 文档';
      case 'xls':
      case 'xlsx':
        return 'Microsoft Excel 表格';
      case 'ppt':
      case 'pptx':
        return 'Microsoft PowerPoint 演示文稿';
      default:
        return 'Office 文档';
    }
  }
}
