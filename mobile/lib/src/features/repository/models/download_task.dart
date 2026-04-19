/// 下载任务
class DownloadTask {
  final String id;
  final String fileName;
  final String fileUrl;
  final String savePath;
  final String repositoryId;
  double progress;
  DownloadStatus status;
  String? error;
  int? downloadedBytes;
  int? totalBytes;

  DownloadTask({
    required this.id,
    required this.fileName,
    required this.fileUrl,
    required this.savePath,
    required this.repositoryId,
    this.progress = 0.0,
    this.status = DownloadStatus.pending,
    this.error,
    this.downloadedBytes,
    this.totalBytes,
  });

  DownloadTask copyWith({
    String? savePath,
    double? progress,
    DownloadStatus? status,
    String? error,
    int? downloadedBytes,
    int? totalBytes,
  }) {
    return DownloadTask(
      id: id,
      fileName: fileName,
      fileUrl: fileUrl,
      savePath: savePath ?? this.savePath,
      repositoryId: repositoryId,
      progress: progress ?? this.progress,
      status: status ?? this.status,
      error: error ?? this.error,
      downloadedBytes: downloadedBytes ?? this.downloadedBytes,
      totalBytes: totalBytes ?? this.totalBytes,
    );
  }
}

enum DownloadStatus {
  pending,
  downloading,
  completed,
  failed,
  cancelled,
}
