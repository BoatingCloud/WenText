import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/network/api_client.dart';
import '../models/download_task.dart';

/// 下载服务
class DownloadService {
  static final DownloadService _instance = DownloadService._internal();
  factory DownloadService() => _instance;
  DownloadService._internal();

  final Dio _dio = ApiClient().mainDio;
  final Map<String, CancelToken> _cancelTokens = {};

  /// 开始下载
  Future<String> downloadFile({
    required String fileId,
    required String fileName,
    required String repositoryId,
    required Function(double) onProgress,
    String? customUrl, // 自定义下载 URL（用于档案附件等）
  }) async {
    try {
      // 获取下载目录
      String savePath;
      if (Platform.isAndroid) {
        // Android: 优先使用外部存储的 Downloads 目录
        // 对于 Android 10+，使用 getExternalStorageDirectory 更可靠
        final Directory? externalDir = await getExternalStorageDirectory();
        if (externalDir != null) {
          // 使用应用的外部存储目录
          final directory = Directory('${externalDir.path}/Download/wenyu');
          if (!await directory.exists()) {
            await directory.create(recursive: true);
          }
          savePath = '${directory.path}/$fileName';
        } else {
          // 降级方案：使用应用文档目录
          final directory = await getApplicationDocumentsDirectory();
          final saveDir = Directory('${directory.path}/downloads/wenyu');
          if (!await saveDir.exists()) {
            await saveDir.create(recursive: true);
          }
          savePath = '${saveDir.path}/$fileName';
        }
      } else {
        // iOS 使用应用文档目录
        final directory = await getApplicationDocumentsDirectory();
        final saveDir = Directory('${directory.path}/downloads/wenyu');
        if (!await saveDir.exists()) {
          await saveDir.create(recursive: true);
        }
        savePath = '${saveDir.path}/$fileName';
      }

      // 创建取消令牌
      final cancelToken = CancelToken();
      _cancelTokens[fileId] = cancelToken;

      // 确定下载 URL
      final downloadUrl = customUrl ?? '/documents/$fileId/download';

      print('DownloadService: 开始下载 - URL: $downloadUrl, 保存路径: $savePath');

      // 下载文件
      await _dio.download(
        downloadUrl,
        savePath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            final progress = received / total;
            onProgress(progress);
          }
        },
      );

      // 移除取消令牌
      _cancelTokens.remove(fileId);

      print('DownloadService: 下载完成 - $savePath');
      return savePath;
    } catch (e) {
      print('DownloadService: 下载失败 - $e');
      _cancelTokens.remove(fileId);
      rethrow;
    }
  }

  /// 取消下载
  void cancelDownload(String fileId) {
    final cancelToken = _cancelTokens[fileId];
    if (cancelToken != null && !cancelToken.isCancelled) {
      cancelToken.cancel('用户取消下载');
      _cancelTokens.remove(fileId);
    }
  }

  /// 获取下载目录
  Future<String> getDownloadDirectory() async {
    final directory = await getApplicationDocumentsDirectory();
    return '${directory.path}/downloads';
  }

  /// 检查文件是否已下载
  Future<bool> isFileDownloaded(String fileName) async {
    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/downloads/$fileName');
    return await file.exists();
  }

  /// 获取已下载文件路径
  Future<String?> getDownloadedFilePath(String fileName) async {
    final directory = await getApplicationDocumentsDirectory();
    final filePath = '${directory.path}/downloads/$fileName';
    final file = File(filePath);
    if (await file.exists()) {
      return filePath;
    }
    return null;
  }
}
