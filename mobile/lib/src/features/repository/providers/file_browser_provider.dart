import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/file_item.dart';
import '../services/file_browser_service.dart';

/// 排序类型
enum SortType {
  name,      // 按名称
  date,      // 按修改时间
  size,      // 按大小
}

/// 排序方向
enum SortOrder {
  ascending,   // 升序
  descending,  // 降序
}

/// 文件类型筛选
enum FileTypeFilter {
  all,       // 全部
  folder,    // 文件夹
  image,     // 图片
  document,  // 文档（PDF、Word、Excel、PPT）
  video,     // 视频
  audio,     // 音频
  archive,   // 压缩包
  text,      // 文本
}

/// 文件浏览状态
class FileBrowserState {
  final List<FileItem> items;
  final String currentPath;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int pageSize;
  final int totalItems;
  final bool hasMore;
  final String searchQuery;
  final bool isSearching;
  final SortType sortType;
  final SortOrder sortOrder;
  final FileTypeFilter fileTypeFilter;

  FileBrowserState({
    this.items = const [],
    this.currentPath = '',
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.pageSize = 50,
    this.totalItems = 0,
    this.hasMore = true,
    this.searchQuery = '',
    this.isSearching = false,
    this.sortType = SortType.name,
    this.sortOrder = SortOrder.ascending,
    this.fileTypeFilter = FileTypeFilter.all,
  });

  FileBrowserState copyWith({
    List<FileItem>? items,
    String? currentPath,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? pageSize,
    int? totalItems,
    bool? hasMore,
    String? searchQuery,
    bool? isSearching,
    SortType? sortType,
    SortOrder? sortOrder,
    FileTypeFilter? fileTypeFilter,
  }) {
    return FileBrowserState(
      items: items ?? this.items,
      currentPath: currentPath ?? this.currentPath,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      pageSize: pageSize ?? this.pageSize,
      totalItems: totalItems ?? this.totalItems,
      hasMore: hasMore ?? this.hasMore,
      searchQuery: searchQuery ?? this.searchQuery,
      isSearching: isSearching ?? this.isSearching,
      sortType: sortType ?? this.sortType,
      sortOrder: sortOrder ?? this.sortOrder,
      fileTypeFilter: fileTypeFilter ?? this.fileTypeFilter,
    );
  }

  /// 获取排序后的项目列表（文件夹优先）
  List<FileItem> get sortedItems {
    final folders = items.where((item) => item.isFolder).toList();
    final files = items.where((item) => item.isFile).toList();

    // 排序函数
    int Function(FileItem, FileItem) getComparator() {
      switch (sortType) {
        case SortType.name:
          return (a, b) {
            final result = a.name.toLowerCase().compareTo(b.name.toLowerCase());
            return sortOrder == SortOrder.ascending ? result : -result;
          };
        case SortType.date:
          return (a, b) {
            final aDate = a.modifiedAt ?? DateTime(1970);
            final bDate = b.modifiedAt ?? DateTime(1970);
            final result = aDate.compareTo(bDate);
            return sortOrder == SortOrder.ascending ? result : -result;
          };
        case SortType.size:
          return (a, b) {
            final aSize = a.size ?? 0;
            final bSize = b.size ?? 0;
            final result = aSize.compareTo(bSize);
            return sortOrder == SortOrder.ascending ? result : -result;
          };
      }
    }

    final comparator = getComparator();
    folders.sort(comparator);
    files.sort(comparator);

    return [...folders, ...files];
  }

  /// 获取过滤后的项目列表（根据搜索关键词和文件类型）
  List<FileItem> get filteredItems {
    var result = sortedItems;

    // 文件类型筛选
    if (fileTypeFilter != FileTypeFilter.all) {
      result = result.where((item) {
        switch (fileTypeFilter) {
          case FileTypeFilter.folder:
            return item.isFolder;
          case FileTypeFilter.image:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].contains(ext);
          case FileTypeFilter.document:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].contains(ext);
          case FileTypeFilter.video:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv'].contains(ext);
          case FileTypeFilter.audio:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].contains(ext);
          case FileTypeFilter.archive:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].contains(ext);
          case FileTypeFilter.text:
            final ext = item.extension?.toLowerCase();
            return ext != null && ['txt', 'md', 'json', 'xml', 'csv', 'log'].contains(ext);
          case FileTypeFilter.all:
            return true;
        }
      }).toList();
    }

    // 搜索关键词筛选
    if (searchQuery.isNotEmpty) {
      final query = searchQuery.toLowerCase();
      result = result.where((item) {
        return item.name.toLowerCase().contains(query);
      }).toList();
    }

    return result;
  }
}

/// 文件浏览 Provider Family（每个仓库一个实例）
final fileBrowserProvider = StateNotifierProvider.family<
    FileBrowserNotifier,
    FileBrowserState,
    String>((ref, repositoryId) {
  return FileBrowserNotifier(repositoryId);
});

/// 文件浏览管理
class FileBrowserNotifier extends StateNotifier<FileBrowserState> {
  final String repositoryId;
  final FileBrowserService _service = FileBrowserService();

  FileBrowserNotifier(this.repositoryId) : super(FileBrowserState());

  /// 加载目录内容
  Future<void> loadDirectory({String path = ''}) async {
    state = state.copyWith(
      isLoading: true,
      error: null,
      currentPath: path,
      currentPage: 1,
      items: [],
    );

    try {
      print('FileBrowserNotifier: 加载目录 - 仓库: $repositoryId, 路径: $path');

      final result = await _service.getDirectoryContents(
        repositoryId: repositoryId,
        path: path,
        page: 1,
        pageSize: state.pageSize,
      );

      if (result.success && result.data != null) {
        final totalItems = result.pagination?.total ?? result.data!.length;
        final totalPages = result.pagination?.totalPages ?? 1;
        final hasMore = state.currentPage < totalPages;

        state = state.copyWith(
          items: result.data!,
          isLoading: false,
          totalItems: totalItems,
          hasMore: hasMore,
        );
        print('FileBrowserNotifier: 成功加载 ${result.data!.length} 个项目, 总计: $totalItems');
      } else {
        state = state.copyWith(
          isLoading: false,
          error: result.message ?? '加载目录失败',
        );
        print('FileBrowserNotifier: 加载失败 - ${result.message}');
      }
    } catch (e) {
      print('FileBrowserNotifier: 加载异常 - $e');
      state = state.copyWith(
        isLoading: false,
        error: '加载目录失败: $e',
      );
    }
  }

  /// 加载更多
  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;

    state = state.copyWith(isLoadingMore: true);

    try {
      final nextPage = state.currentPage + 1;
      print('FileBrowserNotifier: 加载更多 - 页码: $nextPage');

      final result = await _service.getDirectoryContents(
        repositoryId: repositoryId,
        path: state.currentPath,
        page: nextPage,
        pageSize: state.pageSize,
      );

      if (result.success && result.data != null) {
        final newItems = [...state.items, ...result.data!];
        final totalPages = result.pagination?.totalPages ?? 1;
        final hasMore = nextPage < totalPages;

        state = state.copyWith(
          items: newItems,
          currentPage: nextPage,
          isLoadingMore: false,
          hasMore: hasMore,
        );
        print('FileBrowserNotifier: 加载更多成功 - 新增 ${result.data!.length} 个项目, 总计: ${newItems.length}');
      } else {
        state = state.copyWith(isLoadingMore: false);
        print('FileBrowserNotifier: 加载更多失败 - ${result.message}');
      }
    } catch (e) {
      print('FileBrowserNotifier: 加载更多异常 - $e');
      state = state.copyWith(isLoadingMore: false);
    }
  }

  /// 刷新当前目录
  Future<void> refresh() async {
    print('FileBrowserNotifier: 刷新目录 - ${state.currentPath}');
    await loadDirectory(path: state.currentPath);
  }

  /// 进入子目录
  Future<void> enterDirectory(String path) async {
    await loadDirectory(path: path);
  }

  /// 返回上级目录
  Future<void> goBack() async {
    if (state.currentPath.isEmpty) return;

    final parts = state.currentPath.split('/');
    parts.removeLast();
    final parentPath = parts.join('/');

    await loadDirectory(path: parentPath);
  }

  /// 设置搜索关键词
  void setSearchQuery(String query) {
    state = state.copyWith(
      searchQuery: query,
      isSearching: query.isNotEmpty,
    );
  }

  /// 清除搜索
  void clearSearch() {
    state = state.copyWith(
      searchQuery: '',
      isSearching: false,
    );
  }

  /// 设置排序方式
  void setSortType(SortType type) {
    state = state.copyWith(sortType: type);
  }

  /// 切换排序方向
  void toggleSortOrder() {
    state = state.copyWith(
      sortOrder: state.sortOrder == SortOrder.ascending
          ? SortOrder.descending
          : SortOrder.ascending,
    );
  }

  /// 设置排序
  void setSort(SortType type, SortOrder order) {
    state = state.copyWith(
      sortType: type,
      sortOrder: order,
    );
  }

  /// 设置文件类型筛选
  void setFileTypeFilter(FileTypeFilter filter) {
    state = state.copyWith(fileTypeFilter: filter);
  }
}
