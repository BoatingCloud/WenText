import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/repository.dart';
import '../providers/repository_provider.dart';
import 'directory_browser_screen.dart';

/// 仓库浏览页面
class RepositoryScreen extends HookConsumerWidget {
  const RepositoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repositoryState = ref.watch(repositoryListProvider);
    final repositoryNotifier = ref.read(repositoryListProvider.notifier);

    // 初始化加载
    useEffect(() {
      Future.microtask(() => repositoryNotifier.loadRepositories());
      return null;
    }, []);

    return Scaffold(
      appBar: AppBar(
        title: const Text('仓库浏览'),
        actions: [
          IconButton(
            icon: const Icon(Symbols.refresh),
            onPressed: () => repositoryNotifier.refresh(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => repositoryNotifier.refresh(),
        child: _buildBody(context, repositoryState, repositoryNotifier),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    RepositoryListState state,
    RepositoryListNotifier notifier,
  ) {
    if (state.isLoading && state.repositories.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (state.error != null && state.repositories.isEmpty) {
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
              state.error!,
              style: Theme.of(context).textTheme.bodyLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => notifier.refresh(),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (state.repositories.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Symbols.storage,
              size: 64,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              '暂无可访问的仓库',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: state.repositories.length,
      itemBuilder: (context, index) {
        return _buildRepositoryCard(context, state.repositories[index]);
      },
    );
  }

  Widget _buildRepositoryCard(BuildContext context, Repository repository) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DirectoryBrowserScreen(
                repository: repository,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // 仓库图标
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: _getStorageTypeColor(context, repository.storageType)
                      .withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  _getStorageTypeIcon(repository.storageType),
                  size: 32,
                  color: _getStorageTypeColor(context, repository.storageType),
                ),
              ),
              const SizedBox(width: 16),
              // 仓库信息
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      repository.name,
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '编码: ${repository.code}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                    ),
                    if (repository.description != null &&
                        repository.description!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        repository.description!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Symbols.chevron_right,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getStorageTypeIcon(String storageType) {
    switch (storageType) {
      case 'local':
        return Symbols.folder;
      case 'oss':
        return Symbols.cloud;
      case 's3':
        return Symbols.cloud_upload;
      case 'minio':
        return Symbols.storage;
      default:
        return Symbols.folder;
    }
  }

  Color _getStorageTypeColor(BuildContext context, String storageType) {
    switch (storageType) {
      case 'local':
        return Theme.of(context).colorScheme.primary;
      case 'oss':
        return Colors.orange;
      case 's3':
        return Colors.blue;
      case 'minio':
        return Colors.purple;
      default:
        return Theme.of(context).colorScheme.primary;
    }
  }
}
