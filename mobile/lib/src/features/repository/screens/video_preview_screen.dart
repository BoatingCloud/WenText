import 'dart:io';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:video_player/video_player.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/network/api_client.dart';

/// 视频预览页面
class VideoPreviewScreen extends StatefulWidget {
  final String fileUrl;
  final String title;

  const VideoPreviewScreen({
    super.key,
    required this.fileUrl,
    required this.title,
  });

  @override
  State<VideoPreviewScreen> createState() => _VideoPreviewScreenState();
}

class _VideoPreviewScreenState extends State<VideoPreviewScreen> {
  late VideoPlayerController _controller;
  bool _isLoading = true;
  String? _error;
  bool _showControls = true;
  double _downloadProgress = 0.0;
  String? _localFilePath;

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  Future<void> _initializeVideo() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _downloadProgress = 0.0;
    });

    try {
      // 先使用 Dio 下载视频到本地临时文件
      final dio = ApiClient().mainDio;
      final tempDir = await getTemporaryDirectory();
      final fileName = widget.title.replaceAll(RegExp(r'[^\w\s\-\.]'), '_');
      final filePath = '${tempDir.path}/$fileName';

      print('VideoPreviewScreen: 开始下载视频到本地 - $filePath');

      await dio.download(
        widget.fileUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total != -1 && mounted) {
            setState(() {
              _downloadProgress = received / total;
            });
            print('VideoPreviewScreen: 下载进度 ${(received / total * 100).toStringAsFixed(0)}%');
          }
        },
        options: Options(
          responseType: ResponseType.bytes,
        ),
      );

      print('VideoPreviewScreen: 视频下载完成，开始初始化播放器');

      _localFilePath = filePath;

      // 使用本地文件初始化视频播放器
      _controller = VideoPlayerController.file(File(filePath));
      await _controller.initialize();

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        _controller.play();
        print('VideoPreviewScreen: 视频播放器初始化成功');
      }
    } catch (e) {
      print('VideoPreviewScreen: 视频加载失败 - $e');
      if (mounted) {
        setState(() {
          _error = '加载视频失败: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    // 清理临时文件
    if (_localFilePath != null) {
      try {
        final file = File(_localFilePath!);
        if (file.existsSync()) {
          file.deleteSync();
          print('VideoPreviewScreen: 已清理临时视频文件');
        }
      } catch (e) {
        print('VideoPreviewScreen: 清理临时文件失败 - $e');
      }
    }
    super.dispose();
  }

  void _togglePlayPause() {
    setState(() {
      if (_controller.value.isPlaying) {
        _controller.pause();
      } else {
        _controller.play();
      }
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${twoDigits(minutes)}:${twoDigits(seconds)}';
    }
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: _showControls
          ? AppBar(
              backgroundColor: Colors.black.withOpacity(0.7),
              foregroundColor: Colors.white,
              title: Text(widget.title),
              actions: [
                IconButton(
                  icon: const Icon(Symbols.download),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('下载功能开发中')),
                    );
                  },
                ),
              ],
            )
          : null,
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Colors.white),
            const SizedBox(height: 16),
            Text(
              '正在加载视频... ${(_downloadProgress * 100).toStringAsFixed(0)}%',
              style: const TextStyle(color: Colors.white),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48),
              child: LinearProgressIndicator(
                value: _downloadProgress,
                backgroundColor: Colors.white24,
                valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Symbols.error,
              size: 64,
              color: Colors.white54,
            ),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(color: Colors.white54),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _initializeVideo,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    return GestureDetector(
      onTap: _toggleControls,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Center(
            child: AspectRatio(
              aspectRatio: _controller.value.aspectRatio,
              child: VideoPlayer(_controller),
            ),
          ),
          if (_showControls) _buildControls(),
        ],
      ),
    );
  }

  Widget _buildControls() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withOpacity(0.7),
            Colors.transparent,
            Colors.black.withOpacity(0.7),
          ],
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          // 播放/暂停按钮
          Center(
            child: IconButton(
              icon: Icon(
                _controller.value.isPlaying ? Symbols.pause : Symbols.play_arrow,
                size: 64,
                color: Colors.white,
              ),
              onPressed: _togglePlayPause,
            ),
          ),
          const Spacer(),
          // 进度条
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(
                  _formatDuration(_controller.value.position),
                  style: const TextStyle(color: Colors.white),
                ),
                Expanded(
                  child: Slider(
                    value: _controller.value.position.inSeconds.toDouble(),
                    max: _controller.value.duration.inSeconds.toDouble(),
                    onChanged: (value) {
                      _controller.seekTo(Duration(seconds: value.toInt()));
                    },
                  ),
                ),
                Text(
                  _formatDuration(_controller.value.duration),
                  style: const TextStyle(color: Colors.white),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
