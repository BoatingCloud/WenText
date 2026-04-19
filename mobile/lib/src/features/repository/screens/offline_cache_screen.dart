import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// 离线缓存管理页面
class OfflineCacheScreen extends StatefulWidget {
  const OfflineCacheScreen({super.key});

  @override
  State<OfflineCacheScreen> createState() => _OfflineCacheScreenState();
}

class _OfflineCacheScreenState extends State<OfflineCacheScreen> {
  bool _isLoading = true;
  List<CachedFile> _cachedFiles = [];
  int _totalSize = 0;

  @override
  void initState() {
    super.initState();
    _loadCachedFiles();
  }

  Future<void> _loadCachedFiles() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final directory = await getApplicationDocumentsDirectory();
      final downloadDir = Directory('${directory.path}/downloads');

      if (!await downloadDir.exists()) {
        setState(() {
          _cachedFiles = [];
          _totalSize = 0;
          _isLoading = false;
        });
        return;
      }

      final files = <CachedFile>[];
      int totalSize = 0;

      await for (final entity in downloadDir.list()) {
        if (entity is File) {
          final stat = await entity.stat();
          final fileName = entity.path.split('/').last;

          files.add(CachedFile(
            name: fileName,
            path: entity.path,
            size: stat.size,
            modifiedAt: stat.modified,
          ));

          totalSize += stat.size;
        }
      }

      // 按修改时间降序排序
      files.sort((a, b) => b.modifiedAt.compareTo(a.modifiedAt));

      setState(() {
        _cachedFiles = files;
        _totalSize = totalSize;
        _isLoading = false;
      });
    } catch (e) {
      print('加载缓存文件失败: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteFile(CachedFile file) async {
    try {
      final fileEntity = File(file.path);
      if (await fileEntity.exists()) {
        await fileEntity.delete();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已删除: ${file.name}')),
        );
        _loadCachedFiles();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('删除失败: $e')),
      );
    }
  }

  Future<void> _clearAllCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('清空缓存'),
        content: const Text('确定要清空所有离线缓存吗？此操作不可恢复。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确定'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final directory = await getApplicationDocumentsDirectory();
      final downloadDir = Directory('${directory.path}/downloads');

      if (await downloadDir.exists()) {
        await downloadDir.delete(recursive: true);
        await downloadDir.create();
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('已清空所有缓存')),
      );
      _loadCachedFiles();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('清空失败: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('离线缓存'),
        actions: [
          if (_cachedFiles.isNotEmpty)
            IconButton(
              icon: const Icon(Symbols.delete_sweep),
              onPressed: _clearAllCache,
              tooltip: '清空缓存',
            ),
        ],
      ),
      body: Column(
        children: [
          // 缓存统计
          _buildCacheStats(),
          const Divider(height: 1),
          // 文件列表
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildCacheStats() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).colorScheme.surfaceVariant.withOpacity(0.3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            context,
            '文件数量',
            '${_cachedFiles.length}',
            Symbols.folder_open,
          ),
          Container(
            width: 1,
            height: 40,
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
          _buildStatItem(
            context,
            '总大小',
            _formatBytes(_totalSize),
            Symbols.storage,
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    String label,
    String value,
    IconData icon,
  ) {
    return Column(
      children: [
        Icon(
          icon,
          size: 32,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_cachedFiles.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.cloud_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '暂无离线缓存',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCachedFiles,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _cachedFiles.length,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final file = _cachedFiles[index];
          return _buildFileItem(file);
        },
      ),
    );
  }

  Widget _buildFileItem(CachedFile file) {
    return ListTile(
      leading: Icon(
        _getFileIcon(file.name),
        size: 32,
        color: Theme.of(context).colorScheme.primary,
      ),
      title: Text(
        file.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        '${_formatBytes(file.size)} · ${_formatDateTime(file.modifiedAt)}',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
      trailing: PopupMenuButton(
        itemBuilder: (context) => [
          PopupMenuItem(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('打开文件功能开发中')),
              );
            },
            child: const Row(
              children: [
                Icon(Symbols.folder_open),
                SizedBox(width: 12),
                Text('打开'),
              ],
            ),
          ),
          PopupMenuItem(
            onTap: () {
              Future.delayed(Duration.zero, () => _deleteFile(file));
            },
            child: Row(
              children: [
                Icon(Symbols.delete, color: Theme.of(context).colorScheme.error),
                const SizedBox(width: 12),
                Text(
                  '删除',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ),
          ),
        ],
      ),
    );
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

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  String _formatDateTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) return '刚刚';
    if (difference.inMinutes < 60) return '${difference.inMinutes}分钟前';
    if (difference.inHours < 24) return '${difference.inHours}小时前';
    if (difference.inDays < 7) return '${difference.inDays}天前';

    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
  }
}

/// 缓存文件
class CachedFile {
  final String name;
  final String path;
  final int size;
  final DateTime modifiedAt;

  CachedFile({
    required this.name,
    required this.path,
    required this.size,
    required this.modifiedAt,
  });
}
