import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/file_item.dart';
import '../models/download_task.dart';
import '../providers/download_provider.dart';
import '../providers/favorite_provider.dart';
import '../../../core/network/api_client.dart';
import '../widgets/share_dialog.dart';
import 'image_preview_screen.dart';
import 'text_preview_screen.dart';
import 'pdf_preview_screen.dart';
import 'office_preview_screen.dart';
import 'video_preview_screen.dart';
import 'audio_preview_screen.dart';
import 'code_preview_screen.dart';
import 'version_history_screen.dart';

/// 文档详情页面
class DocumentDetailScreen extends ConsumerWidget {
  final FileItem file;
  final String repositoryId;

  const DocumentDetailScreen({
    super.key,
    required this.file,
    required this.repositoryId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloadState = ref.watch(downloadManagerProvider);
    final downloadNotifier = ref.read(downloadManagerProvider.notifier);
    final downloadTask = downloadState.tasks[file.id];

    final favoriteState = ref.watch(favoriteManagerProvider);
    final favoriteNotifier = ref.read(favoriteManagerProvider.notifier);
    final isFavorited = favoriteState.isFavorited(file.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(file.name),
        actions: [
          IconButton(
            icon: const Icon(Symbols.more_vert),
            onPressed: () => _showMoreOptions(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 预览区域
            _buildPreviewSection(context),
            const SizedBox(height: 16),
            // 基本信息
            _buildInfoSection(context),
            const SizedBox(height: 16),
            // 元数据信息
            if (file.createdBy != null || file.updatedBy != null)
              _buildMetadataSection(context),
            if (file.createdBy != null || file.updatedBy != null)
              const SizedBox(height: 16),
            // 标签
            if (file.tags != null && file.tags!.isNotEmpty)
              _buildTagsSection(context),
            if (file.tags != null && file.tags!.isNotEmpty)
              const SizedBox(height: 16),
            // 描述
            if (file.description != null && file.description!.isNotEmpty)
              _buildDescriptionSection(context),
            if (file.description != null && file.description!.isNotEmpty)
              const SizedBox(height: 16),
            // 下载进度
            if (downloadTask != null) _buildDownloadProgress(context, downloadTask),
            if (downloadTask != null) const SizedBox(height: 16),
            // 操作按钮
            _buildActionsSection(
              context,
              downloadTask,
              downloadNotifier,
              isFavorited,
              favoriteNotifier,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewSection(BuildContext context) {
    return Container(
      height: 300,
      color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _getFileIcon(),
              size: 80,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              _getPreviewHint(),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            if (_canPreview()) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _handlePreview(context),
                icon: const Icon(Symbols.visibility),
                label: const Text('预览'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoSection(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
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
            _buildInfoRow(context, '文件名称', file.name),
            _buildInfoRow(context, '文件类型', _getFileTypeDescription()),
            _buildInfoRow(context, '文件大小', file.getFormattedSize()),
            if (file.modifiedAt != null)
              _buildInfoRow(
                context,
                '修改时间',
                _formatDateTime(file.modifiedAt!),
              ),
            if (file.createdAt != null)
              _buildInfoRow(
                context,
                '创建时间',
                _formatDateTime(file.createdAt!),
              ),
            if (file.version != null)
              _buildInfoRow(context, '版本号', 'v${file.version}'),
            _buildInfoRow(
              context,
              '文件路径',
              file.path,
              copyable: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetadataSection(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '元数据',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            if (file.createdBy != null)
              _buildInfoRow(context, '创建者', file.createdBy!),
            if (file.updatedBy != null)
              _buildInfoRow(context, '修改者', file.updatedBy!),
            if (file.mimeType != null)
              _buildInfoRow(context, 'MIME类型', file.mimeType!),
          ],
        ),
      ),
    );
  }

  Widget _buildTagsSection(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '标签',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: file.tags!.map((tag) {
                return Chip(
                  label: Text(tag),
                  backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
                  labelStyle: TextStyle(
                    color: Theme.of(context).colorScheme.onSecondaryContainer,
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDescriptionSection(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '描述',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            Text(
              file.description!,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context,
    String label,
    String value, {
    bool copyable = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
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
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                if (copyable)
                  IconButton(
                    icon: const Icon(Symbols.content_copy, size: 18),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: value));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('已复制到剪贴板')),
                      );
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsSection(
    BuildContext context,
    DownloadTask? downloadTask,
    DownloadManagerNotifier downloadNotifier,
    bool isFavorited,
    FavoriteManagerNotifier favoriteNotifier,
  ) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildDownloadButton(
                  context,
                  downloadTask,
                  downloadNotifier,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => ShareDialog(
                        fileId: file.id,
                        fileName: file.name,
                      ),
                    );
                  },
                  icon: const Icon(Symbols.share),
                  label: const Text('分享'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await favoriteNotifier.toggleFavorite(
                      fileId: file.id,
                      fileName: file.name,
                      filePath: file.path,
                      fileExtension: file.extension,
                      repositoryId: repositoryId,
                      repositoryName: '', // TODO: 传入仓库名称
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(isFavorited ? '已取消收藏' : '已添加收藏'),
                      ),
                    );
                  },
                  icon: Icon(isFavorited ? Symbols.star : Symbols.star, fill: isFavorited ? 1 : 0),
                  label: Text(isFavorited ? '已收藏' : '收藏'),
                  style: isFavorited
                      ? OutlinedButton.styleFrom(
                          foregroundColor: Theme.of(context).colorScheme.primary,
                        )
                      : null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => VersionHistoryScreen(
                          fileId: file.id,
                          fileName: file.name,
                          repositoryId: repositoryId,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Symbols.history),
                  label: const Text('版本历史'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDownloadProgress(BuildContext context, DownloadTask task) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _getDownloadStatusText(task.status),
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
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: task.progress,
              backgroundColor:
                  Theme.of(context).colorScheme.surfaceVariant,
            ),
            if (task.error != null) ...[
              const SizedBox(height: 8),
              Text(
                task.error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDownloadButton(
    BuildContext context,
    DownloadTask? downloadTask,
    DownloadManagerNotifier downloadNotifier,
  ) {
    if (downloadTask != null) {
      switch (downloadTask.status) {
        case DownloadStatus.downloading:
          return ElevatedButton.icon(
            onPressed: () {
              downloadNotifier.cancelDownload(file.id);
            },
            icon: const Icon(Symbols.close),
            label: const Text('取消下载'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
          );
        case DownloadStatus.completed:
          return ElevatedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('打开文件功能开发中')),
              );
            },
            icon: const Icon(Symbols.folder_open),
            label: const Text('打开文件'),
          );
        case DownloadStatus.failed:
          return ElevatedButton.icon(
            onPressed: () {
              downloadNotifier.startDownload(
                fileId: file.id,
                fileName: file.name,
                repositoryId: repositoryId,
              );
            },
            icon: const Icon(Symbols.refresh),
            label: const Text('重试下载'),
          );
        default:
          break;
      }
    }

    return ElevatedButton.icon(
      onPressed: () {
        downloadNotifier.startDownload(
          fileId: file.id,
          fileName: file.name,
          repositoryId: repositoryId,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('开始下载: ${file.name}')),
        );
      },
      icon: const Icon(Symbols.download),
      label: const Text('下载'),
    );
  }

  String _getDownloadStatusText(DownloadStatus status) {
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

  void _showMoreOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Symbols.download),
              title: const Text('下载'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('下载功能开发中')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Symbols.share),
              title: const Text('分享'),
              enabled: false,
              onTap: () {},
            ),
            ListTile(
              leading: const Icon(Symbols.star),
              title: const Text('收藏'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('收藏功能开发中')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Symbols.history),
              title: const Text('版本历史'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('版本历史功能开发中')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Symbols.content_copy),
              title: const Text('复制路径'),
              onTap: () {
                Navigator.pop(context);
                Clipboard.setData(ClipboardData(text: file.path));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('已复制到剪贴板')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  IconData _getFileIcon() {
    final ext = file.extension?.toLowerCase();
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
      case 'mp4':
      case 'avi':
        return Symbols.video_file;
      case 'mp3':
      case 'wav':
        return Symbols.audio_file;
      case 'zip':
      case 'rar':
        return Symbols.folder_zip;
      case 'txt':
      case 'md':
        return Symbols.text_snippet;
      default:
        return Symbols.insert_drive_file;
    }
  }

  String _getFileTypeDescription() {
    final ext = file.extension?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'PDF 文档';
      case 'doc':
      case 'docx':
        return 'Word 文档';
      case 'xls':
      case 'xlsx':
        return 'Excel 表格';
      case 'ppt':
      case 'pptx':
        return 'PowerPoint 演示文稿';
      case 'jpg':
      case 'jpeg':
        return 'JPEG 图片';
      case 'png':
        return 'PNG 图片';
      case 'gif':
        return 'GIF 图片';
      case 'mp4':
        return 'MP4 视频';
      case 'mp3':
        return 'MP3 音频';
      case 'zip':
        return 'ZIP 压缩包';
      case 'txt':
        return '文本文件';
      case 'md':
        return 'Markdown 文档';
      default:
        return file.extension != null
            ? '${file.extension!.toUpperCase()} 文件'
            : '未知类型';
    }
  }

  String _getPreviewHint() {
    if (_canPreview()) {
      return '点击下方按钮预览文件';
    }
    final ext = file.extension?.toLowerCase();
    if (ext != null && ['zip', 'rar', '7z', 'tar', 'gz'].contains(ext)) {
      return '压缩文件需要下载后解压';
    }
    return '此文件类型暂不支持在线预览';
  }

  bool _canPreview() {
    final ext = file.extension?.toLowerCase();
    print('DocumentDetailScreen: 检查预览支持 - 文件名: ${file.name}, 扩展名: $ext');
    final canPreview = ext != null &&
        [
          // 图片
          'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
          // 文档
          'pdf', 'txt', 'md',
          // Office
          'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
          // 视频
          'mp4', 'avi', 'mov', 'mkv', 'webm', 'flv',
          // 音频
          'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a',
          // 代码
          'js', 'ts', 'jsx', 'tsx', 'dart', 'java', 'kt', 'swift',
          'py', 'go', 'rs', 'c', 'cpp', 'h', 'cs', 'php', 'rb',
          'sh', 'bash', 'sql', 'html', 'xml', 'css', 'scss', 'sass',
          'json', 'yaml', 'yml', 'toml', 'ini', 'conf',
        ].contains(ext);
    print('DocumentDetailScreen: 是否支持预览: $canPreview');
    return canPreview;
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  void _handlePreview(BuildContext context) {
    final ext = file.extension?.toLowerCase();

    // 构建文件预览/下载URL
    final fileUrl = '/documents/${file.id}/download';

    // 图片预览
    if (ext != null && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ImagePreviewScreen(
            imageUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // 视频预览
    if (ext != null && ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoPreviewScreen(
            fileUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // 音频预览
    if (ext != null && ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => AudioPreviewScreen(
            fileUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // 代码文件预览
    if (ext != null && [
      'js', 'ts', 'jsx', 'tsx', 'dart', 'java', 'kt', 'swift',
      'py', 'go', 'rs', 'c', 'cpp', 'h', 'cs', 'php', 'rb',
      'sh', 'bash', 'sql', 'html', 'xml', 'css', 'scss', 'sass',
      'json', 'yaml', 'yml', 'toml', 'ini', 'conf',
    ].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CodePreviewScreen(
            fileUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // 文本预览
    if (ext != null && ['txt', 'md'].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => TextPreviewScreen(
            fileUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // PDF预览
    if (ext == 'pdf') {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PdfPreviewScreen(
            fileUrl: fileUrl,
            title: file.name,
          ),
        ),
      );
      return;
    }

    // Office文件预览
    if (ext != null && ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].contains(ext)) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => OfficePreviewScreen(
            fileUrl: fileUrl,
            fileId: file.id,
            repositoryId: repositoryId,
            title: file.name,
            fileExtension: ext,
          ),
        ),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('此文件类型暂不支持预览')),
    );
  }
}
