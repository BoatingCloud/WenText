import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/download_task.dart';
import '../providers/download_provider.dart';

/// 下载管理页面
class DownloadManagerScreen extends ConsumerWidget {
  const DownloadManagerScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloadState = ref.watch(downloadManagerProvider);
    final downloadNotifier = ref.read(downloadManagerProvider.notifier);

    final tasks = downloadState.tasks.values.toList();
    final activeTasks = tasks.where((t) =>
      t.status == DownloadStatus.downloading ||
      t.status == DownloadStatus.pending
    ).toList();
    final completedTasks = tasks.where((t) =>
      t.status == DownloadStatus.completed
    ).toList();
    final failedTasks = tasks.where((t) =>
      t.status == DownloadStatus.failed ||
      t.status == DownloadStatus.cancelled
    ).toList();

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('下载管理'),
          bottom: TabBar(
            tabs: [
              Tab(text: '进行中 (${activeTasks.length})'),
              Tab(text: '已完成 (${completedTasks.length})'),
              Tab(text: '失败 (${failedTasks.length})'),
            ],
          ),
          actions: [
            if (tasks.isNotEmpty)
              PopupMenuButton(
                itemBuilder: (context) => [
                  PopupMenuItem(
                    onTap: () {
                      downloadNotifier.clearCompleted();
                    },
                    child: const Row(
                      children: [
                        Icon(Symbols.delete_sweep),
                        SizedBox(width: 12),
                        Text('清除已完成'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    onTap: () {
                      downloadNotifier.clearFailed();
                    },
                    child: const Row(
                      children: [
                        Icon(Symbols.clear_all),
                        SizedBox(width: 12),
                        Text('清除失败'),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ),
        body: TabBarView(
          children: [
            _buildTaskList(context, activeTasks, downloadNotifier, isActive: true),
            _buildTaskList(context, completedTasks, downloadNotifier),
            _buildTaskList(context, failedTasks, downloadNotifier),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskList(
    BuildContext context,
    List<DownloadTask> tasks,
    DownloadManagerNotifier notifier, {
    bool isActive = false,
  }) {
    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.download_done,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '暂无下载任务',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: tasks.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final task = tasks[index];
        return _buildTaskCard(context, task, notifier, isActive: isActive);
      },
    );
  }

  Widget _buildTaskCard(
    BuildContext context,
    DownloadTask task,
    DownloadManagerNotifier notifier, {
    bool isActive = false,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getStatusIcon(task.status),
                  color: _getStatusColor(context, task.status),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        task.fileName,
                        style: Theme.of(context).textTheme.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _getStatusText(task.status),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: _getStatusColor(context, task.status),
                            ),
                      ),
                    ],
                  ),
                ),
                _buildActionButton(context, task, notifier),
              ],
            ),
            if (isActive && task.status == DownloadStatus.downloading) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(
                value: task.progress,
                backgroundColor: Theme.of(context).colorScheme.surfaceVariant,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${(task.progress * 100).toStringAsFixed(0)}%',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (task.downloadedBytes != null && task.totalBytes != null)
                    Text(
                      '${_formatBytes(task.downloadedBytes!)} / ${_formatBytes(task.totalBytes!)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ],
            if (task.error != null) ...[
              const SizedBox(height: 8),
              Text(
                task.error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(
    BuildContext context,
    DownloadTask task,
    DownloadManagerNotifier notifier,
  ) {
    switch (task.status) {
      case DownloadStatus.downloading:
        return IconButton(
          icon: const Icon(Symbols.pause),
          onPressed: () {
            notifier.cancelDownload(task.fileId);
          },
          tooltip: '取消',
        );
      case DownloadStatus.failed:
        return IconButton(
          icon: const Icon(Symbols.refresh),
          onPressed: () {
            notifier.startDownload(
              fileId: task.fileId,
              fileName: task.fileName,
              repositoryId: task.repositoryId,
            );
          },
          tooltip: '重试',
        );
      case DownloadStatus.completed:
        return IconButton(
          icon: const Icon(Symbols.folder_open),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('打开文件功能开发中')),
            );
          },
          tooltip: '打开',
        );
      default:
        return const SizedBox.shrink();
    }
  }

  IconData _getStatusIcon(DownloadStatus status) {
    switch (status) {
      case DownloadStatus.pending:
        return Symbols.schedule;
      case DownloadStatus.downloading:
        return Symbols.downloading;
      case DownloadStatus.completed:
        return Symbols.check_circle;
      case DownloadStatus.failed:
        return Symbols.error;
      case DownloadStatus.cancelled:
        return Symbols.cancel;
    }
  }

  Color _getStatusColor(BuildContext context, DownloadStatus status) {
    switch (status) {
      case DownloadStatus.pending:
        return Theme.of(context).colorScheme.onSurfaceVariant;
      case DownloadStatus.downloading:
        return Theme.of(context).colorScheme.primary;
      case DownloadStatus.completed:
        return Colors.green;
      case DownloadStatus.failed:
        return Theme.of(context).colorScheme.error;
      case DownloadStatus.cancelled:
        return Theme.of(context).colorScheme.onSurfaceVariant;
    }
  }

  String _getStatusText(DownloadStatus status) {
    switch (status) {
      case DownloadStatus.pending:
        return '等待下载';
      case DownloadStatus.downloading:
        return '正在下载';
      case DownloadStatus.completed:
        return '下载完成';
      case DownloadStatus.failed:
        return '下载失败';
      case DownloadStatus.cancelled:
        return '已取消';
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}
