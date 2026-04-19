import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../models/download_task.dart';
import '../services/download_service.dart';

/// 下载管理状态
class DownloadManagerState {
  final Map<String, DownloadTask> tasks;

  DownloadManagerState({
    this.tasks = const {},
  });

  DownloadManagerState copyWith({
    Map<String, DownloadTask>? tasks,
  }) {
    return DownloadManagerState(
      tasks: tasks ?? this.tasks,
    );
  }

  List<DownloadTask> get activeTasks {
    return tasks.values
        .where((task) =>
            task.status == DownloadStatus.downloading ||
            task.status == DownloadStatus.pending)
        .toList();
  }

  List<DownloadTask> get completedTasks {
    return tasks.values
        .where((task) => task.status == DownloadStatus.completed)
        .toList();
  }
}

/// 下载管理 Provider
final downloadManagerProvider =
    StateNotifierProvider<DownloadManagerNotifier, DownloadManagerState>(
  (ref) => DownloadManagerNotifier(),
);

/// 下载管理
class DownloadManagerNotifier extends StateNotifier<DownloadManagerState> {
  final DownloadService _service = DownloadService();

  DownloadManagerNotifier() : super(DownloadManagerState());

  /// 开始下载
  Future<void> startDownload({
    required String fileId,
    required String fileName,
    required String repositoryId,
    String? customUrl, // 自定义下载 URL
  }) async {
    // 检查是否已经在下载
    if (state.tasks.containsKey(fileId)) {
      final task = state.tasks[fileId]!;
      if (task.status == DownloadStatus.downloading) {
        print('DownloadManager: 文件已在下载中 - $fileName');
        return;
      }
    }

    // 创建下载任务
    final task = DownloadTask(
      id: fileId,
      fileName: fileName,
      fileUrl: customUrl ?? '/repositories/$repositoryId/files/$fileId/download',
      savePath: '',
      repositoryId: repositoryId,
      status: DownloadStatus.downloading,
    );

    // 更新状态
    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks[fileId] = task;
    state = state.copyWith(tasks: newTasks);

    try {
      print('DownloadManager: 开始下载 - $fileName');

      final savePath = await _service.downloadFile(
        fileId: fileId,
        fileName: fileName,
        repositoryId: repositoryId,
        customUrl: customUrl,
        onProgress: (progress) {
          _updateTaskProgress(fileId, progress);
        },
      );

      // 下载完成
      _updateTaskStatus(
        fileId,
        DownloadStatus.completed,
        savePath: savePath,
      );

      print('DownloadManager: 下载完成 - $fileName');
    } catch (e) {
      print('DownloadManager: 下载失败 - $fileName: $e');
      _updateTaskStatus(
        fileId,
        DownloadStatus.failed,
        error: e.toString(),
      );
    }
  }

  /// 取消下载
  void cancelDownload(String fileId) {
    _service.cancelDownload(fileId);
    _updateTaskStatus(fileId, DownloadStatus.cancelled);
  }

  /// 移除任务
  void removeTask(String fileId) {
    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks.remove(fileId);
    state = state.copyWith(tasks: newTasks);
  }

  /// 清空已完成任务
  void clearCompletedTasks() {
    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks.removeWhere((key, task) => task.status == DownloadStatus.completed);
    state = state.copyWith(tasks: newTasks);
  }

  /// 清空已完成任务（别名）
  void clearCompleted() {
    clearCompletedTasks();
  }

  /// 清空失败任务
  void clearFailed() {
    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks.removeWhere((key, task) =>
      task.status == DownloadStatus.failed ||
      task.status == DownloadStatus.cancelled
    );
    state = state.copyWith(tasks: newTasks);
  }

  /// 更新任务进度
  void _updateTaskProgress(String fileId, double progress) {
    final task = state.tasks[fileId];
    if (task == null) return;

    final updatedTask = task.copyWith(progress: progress);
    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks[fileId] = updatedTask;
    state = state.copyWith(tasks: newTasks);
  }

  /// 更新任务状态
  void _updateTaskStatus(
    String fileId,
    DownloadStatus status, {
    String? savePath,
    String? error,
  }) {
    final task = state.tasks[fileId];
    if (task == null) return;

    final updatedTask = task.copyWith(
      status: status,
      savePath: savePath,
      error: error,
    );

    final newTasks = Map<String, DownloadTask>.from(state.tasks);
    newTasks[fileId] = updatedTask;
    state = state.copyWith(tasks: newTasks);
  }
}
