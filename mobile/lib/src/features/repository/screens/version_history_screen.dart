import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/file_version.dart';
import '../services/version_service.dart';

/// 版本历史页面
class VersionHistoryScreen extends StatefulWidget {
  final String fileId;
  final String fileName;
  final String repositoryId;

  const VersionHistoryScreen({
    super.key,
    required this.fileId,
    required this.fileName,
    required this.repositoryId,
  });

  @override
  State<VersionHistoryScreen> createState() => _VersionHistoryScreenState();
}

class _VersionHistoryScreenState extends State<VersionHistoryScreen> {
  final VersionService _versionService = VersionService();
  List<FileVersion> _versions = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadVersionHistory();
  }

  Future<void> _loadVersionHistory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final response = await _versionService.getVersionHistory(
      fileId: widget.fileId,
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (response.success && response.data != null) {
          _versions = response.data!;
        } else {
          _error = response.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('版本历史'),
        actions: [
          IconButton(
            icon: const Icon(Symbols.refresh),
            onPressed: _loadVersionHistory,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
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
              _error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadVersionHistory,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_versions.isEmpty) {
      return _buildEmptyState(context);
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _versions.length,
      separatorBuilder: (context, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        return _buildVersionItem(context, _versions[index]);
      },
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Symbols.history,
            size: 64,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: 16),
          Text(
            '暂无版本历史',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildVersionItem(BuildContext context, FileVersion version) {
    final isLatest = _versions.isNotEmpty && version.version == _versions.first.version;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: isLatest
            ? Theme.of(context).colorScheme.primaryContainer
            : Theme.of(context).colorScheme.surfaceVariant,
        child: Text(
          'v${version.version}',
          style: TextStyle(
            color: isLatest
                ? Theme.of(context).colorScheme.onPrimaryContainer
                : Theme.of(context).colorScheme.onSurfaceVariant,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      title: Row(
        children: [
          Text('版本 ${version.version}'),
          if (isLatest) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '当前',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onPrimary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          if (version.comment != null && version.comment!.isNotEmpty)
            Text(
              version.comment!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const SizedBox(height: 4),
          Text(
            '${version.getFormattedSize()} · ${version.getFormattedTime()}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          if (version.createdBy != null) ...[
            const SizedBox(height: 2),
            Text(
              '上传者: ${version.createdBy}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ],
      ),
      trailing: PopupMenuButton<String>(
        icon: const Icon(Symbols.more_vert),
        onSelected: (value) {
          switch (value) {
            case 'download':
              _handleDownloadVersion(version);
              break;
            case 'restore':
              _showRestoreDialog(context, version);
              break;
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(
            value: 'download',
            child: Row(
              children: [
                Icon(Symbols.download),
                SizedBox(width: 12),
                Text('下载'),
              ],
            ),
          ),
          if (!isLatest)
            const PopupMenuItem(
              value: 'restore',
              child: Row(
                children: [
                  Icon(Symbols.restore),
                  SizedBox(width: 12),
                  Text('恢复此版本'),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _handleDownloadVersion(FileVersion version) async {
    final response = await _versionService.getVersionDownloadUrl(
      fileId: widget.fileId,
      versionId: version.id,
    );

    if (mounted) {
      if (response.success && response.data != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('开始下载版本 ${version.version}')),
        );
        // TODO: 实际下载逻辑
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response.message ?? '下载失败')),
        );
      }
    }
  }

  void _showRestoreDialog(BuildContext context, FileVersion version) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('恢复版本'),
        content: Text('确定要恢复到版本 ${version.version} 吗？\n\n这将创建一个新版本。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              await _handleRestoreVersion(version);
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleRestoreVersion(FileVersion version) async {
    final response = await _versionService.restoreVersion(
      fileId: widget.fileId,
      versionId: version.id,
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response.message ?? '操作失败')),
      );

      if (response.success) {
        // 重新加载版本历史
        _loadVersionHistory();
      }
    }
  }
}
