import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/file_item.dart';
import '../models/repository.dart';
import '../services/search_service.dart';
import 'document_detail_screen.dart';

/// 文档搜索页面
class DocumentSearchScreen extends HookConsumerWidget {
  final Repository repository;

  const DocumentSearchScreen({
    super.key,
    required this.repository,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchController = useTextEditingController();
    final searchResults = useState<List<FileItem>>([]);
    final isSearching = useState<bool>(false);
    final hasSearched = useState<bool>(false);
    final error = useState<String?>(null);
    final searchService = useMemoized(() => SearchService());

    Future<void> performSearch(String query) async {
      if (query.trim().isEmpty) {
        searchResults.value = [];
        hasSearched.value = false;
        return;
      }

      isSearching.value = true;
      error.value = null;

      try {
        final result = await searchService.searchDocuments(
          repositoryId: repository.id,
          query: query.trim(),
        );

        if (result.success && result.data != null) {
          searchResults.value = result.data!;
          hasSearched.value = true;
        } else {
          error.value = result.message ?? '搜索失败';
          searchResults.value = [];
          hasSearched.value = true;
        }
      } catch (e) {
        error.value = '搜索失败: $e';
        searchResults.value = [];
        hasSearched.value = true;
      } finally {
        isSearching.value = false;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: searchController,
          autofocus: true,
          decoration: InputDecoration(
            hintText: '搜索文档...',
            border: InputBorder.none,
            hintStyle: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (value) => performSearch(value),
        ),
        actions: [
          if (searchController.text.isNotEmpty)
            IconButton(
              icon: const Icon(Symbols.close),
              onPressed: () {
                searchController.clear();
                searchResults.value = [];
                hasSearched.value = false;
                error.value = null;
              },
            ),
          IconButton(
            icon: const Icon(Symbols.search),
            onPressed: () => performSearch(searchController.text),
          ),
        ],
      ),
      body: _buildBody(
        context,
        searchResults.value,
        isSearching.value,
        hasSearched.value,
        error.value,
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    List<FileItem> results,
    bool isSearching,
    bool hasSearched,
    String? error,
  ) {
    if (isSearching) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('正在搜索...'),
          ],
        ),
      );
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

    if (!hasSearched) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.search,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '输入关键词搜索文档',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              '支持搜索文件名、内容等',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.search_off,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '未找到匹配的文档',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              '尝试使用其他关键词',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: results.length,
      separatorBuilder: (context, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final item = results[index];
        return _buildSearchResultItem(context, item);
      },
    );
  }

  Widget _buildSearchResultItem(BuildContext context, FileItem item) {
    return ListTile(
      leading: Icon(
        _getFileIcon(item),
        size: 32,
        color: item.isFolder
            ? Theme.of(context).colorScheme.primary
            : Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      title: Text(
        item.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.path,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            item.isFolder
                ? '文件夹'
                : '${item.getFormattedSize()} · ${item.getRelativeTime()}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
      trailing: Icon(
        item.isFolder ? Symbols.chevron_right : Symbols.open_in_new,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      onTap: () {
        if (item.isFile) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DocumentDetailScreen(
                file: item,
                repositoryId: repository.id,
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('文件夹导航功能开发中')),
          );
        }
      },
    );
  }

  IconData _getFileIcon(FileItem item) {
    if (item.isFolder) return Symbols.folder;

    final ext = item.extension?.toLowerCase();
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
      case 'bmp':
        return Symbols.image;
      case 'mp4':
      case 'avi':
      case 'mov':
        return Symbols.video_file;
      case 'mp3':
      case 'wav':
        return Symbols.audio_file;
      case 'zip':
      case 'rar':
      case '7z':
        return Symbols.folder_zip;
      case 'txt':
      case 'md':
        return Symbols.text_snippet;
      default:
        return Symbols.insert_drive_file;
    }
  }
}
