import 'package:dio/dio.dart';
import '../network/api_client.dart';
import '../network/api_response.dart';

/// 版本信息
class VersionInfo {
  final String version;
  final String? downloadUrl;
  final String? releaseNotes;
  final bool forceUpdate;

  VersionInfo({
    required this.version,
    this.downloadUrl,
    this.releaseNotes,
    this.forceUpdate = false,
  });

  factory VersionInfo.fromJson(Map<String, dynamic> json) {
    return VersionInfo(
      version: json['latestVersion']?.toString() ?? json['version']?.toString() ?? '',
      downloadUrl: json['downloadUrl'],
      releaseNotes: json['releaseNotes'],
      forceUpdate: json['forceUpdate'] ?? false,
    );
  }
}

/// 版本检查响应
class VersionCheckResponse {
  final bool hasUpdate;
  final VersionInfo? versionInfo;

  VersionCheckResponse({
    required this.hasUpdate,
    this.versionInfo,
  });

  factory VersionCheckResponse.fromJson(Map<String, dynamic> json) {
    return VersionCheckResponse(
      hasUpdate: json['hasUpdate'] ?? false,
      versionInfo: json['hasUpdate'] == true ? VersionInfo.fromJson(json) : null,
    );
  }
}

/// 版本检查服务
class VersionService {
  final Dio _dio = ApiClient().mobileDio;

  /// 检查更新
  Future<VersionCheckResponse> checkUpdate({
    required String currentVersion,
    required String platform,
  }) async {
    try {
      print('正在检查更新: currentVersion=$currentVersion, platform=$platform');
      final response = await _dio.get(
        '/app-versions/check',
        queryParameters: {
          'currentVersion': currentVersion,
          'platform': platform,
        },
      );

      print('版本检查响应: ${response.statusCode}');
      print('响应数据: ${response.data}');

      return VersionCheckResponse.fromJson(response.data);
    } on DioException catch (e) {
      print('版本检查错误: ${e.type} - ${e.message}');
      if (e.response != null) {
        print('错误响应: ${e.response!.data}');
      }
      throw Exception('检查更新失败: ${e.message}');
    } catch (e) {
      print('版本检查未知错误: $e');
      throw Exception('检查更新失败: $e');
    }
  }
}
