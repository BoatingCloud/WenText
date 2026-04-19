import 'dart:io';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/network/api_client.dart';

/// 音频预览页面
class AudioPreviewScreen extends StatefulWidget {
  final String fileUrl;
  final String title;

  const AudioPreviewScreen({
    super.key,
    required this.fileUrl,
    required this.title,
  });

  @override
  State<AudioPreviewScreen> createState() => _AudioPreviewScreenState();
}

class _AudioPreviewScreenState extends State<AudioPreviewScreen> {
  late AudioPlayer _audioPlayer;
  bool _isLoading = true;
  String? _error;
  bool _isPlaying = false;
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;
  double _downloadProgress = 0.0;
  String? _localFilePath;

  @override
  void initState() {
    super.initState();
    _initializeAudio();
  }

  Future<void> _initializeAudio() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _downloadProgress = 0.0;
    });

    try {
      // 先使用 Dio 下载音频到本地临时文件
      final dio = ApiClient().mainDio;
      final tempDir = await getTemporaryDirectory();
      final fileName = widget.title.replaceAll(RegExp(r'[^\w\s\-\.]'), '_');
      final filePath = '${tempDir.path}/$fileName';

      print('AudioPreviewScreen: 开始下载音频到本地 - $filePath');

      await dio.download(
        widget.fileUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total != -1 && mounted) {
            setState(() {
              _downloadProgress = received / total;
            });
            print('AudioPreviewScreen: 下载进度 ${(received / total * 100).toStringAsFixed(0)}%');
          }
        },
        options: Options(
          responseType: ResponseType.bytes,
        ),
      );

      print('AudioPreviewScreen: 音频下载完成，开始初始化播放器');

      _localFilePath = filePath;

      _audioPlayer = AudioPlayer();

      // 监听播放状态
      _audioPlayer.onPlayerStateChanged.listen((state) {
        if (mounted) {
          setState(() {
            _isPlaying = state == PlayerState.playing;
          });
        }
      });

      // 监听播放进度
      _audioPlayer.onDurationChanged.listen((duration) {
        if (mounted) {
          setState(() {
            _duration = duration;
          });
        }
      });

      _audioPlayer.onPositionChanged.listen((position) {
        if (mounted) {
          setState(() {
            _position = position;
          });
        }
      });

      // 监听播放完成
      _audioPlayer.onPlayerComplete.listen((_) {
        if (mounted) {
          setState(() {
            _isPlaying = false;
            _position = Duration.zero;
          });
        }
      });

      // 使用本地文件播放
      await _audioPlayer.setSourceDeviceFile(filePath);

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        print('AudioPreviewScreen: 音频播放器初始化成功');
      }
    } catch (e) {
      print('AudioPreviewScreen: 音频加载失败 - $e');
      if (mounted) {
        setState(() {
          _error = '加载音频失败: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    // 清理临时文件
    if (_localFilePath != null) {
      try {
        final file = File(_localFilePath!);
        if (file.existsSync()) {
          file.deleteSync();
          print('AudioPreviewScreen: 已清理临时音频文件');
        }
      } catch (e) {
        print('AudioPreviewScreen: 清理临时文件失败 - $e');
      }
    }
    super.dispose();
  }

  Future<void> _togglePlayPause() async {
    if (_isPlaying) {
      await _audioPlayer.pause();
    } else {
      await _audioPlayer.resume();
    }
  }

  Future<void> _seekTo(Duration position) async {
    await _audioPlayer.seek(position);
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${twoDigits(minutes)}:${twoDigits(seconds)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
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
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              Text(
                '正在加载音频... ${(_downloadProgress * 100).toStringAsFixed(0)}%',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: _downloadProgress,
              ),
            ],
          ),
        ),
      );
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
              onPressed: _initializeAudio,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 音频图标
            Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Symbols.music_note,
                size: 100,
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: 48),
            // 文件名
            Text(
              widget.title,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 48),
            // 进度条
            Column(
              children: [
                Slider(
                  value: _position.inSeconds.toDouble(),
                  max: _duration.inSeconds.toDouble(),
                  onChanged: (value) {
                    _seekTo(Duration(seconds: value.toInt()));
                  },
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _formatDuration(_position),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        _formatDuration(_duration),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // 播放控制按钮
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  icon: const Icon(Symbols.skip_previous),
                  iconSize: 48,
                  onPressed: () {
                    _seekTo(Duration.zero);
                  },
                ),
                const SizedBox(width: 24),
                Container(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: Icon(
                      _isPlaying ? Symbols.pause : Symbols.play_arrow,
                      color: Theme.of(context).colorScheme.onPrimary,
                    ),
                    iconSize: 48,
                    onPressed: _togglePlayPause,
                  ),
                ),
                const SizedBox(width: 24),
                IconButton(
                  icon: const Icon(Symbols.skip_next),
                  iconSize: 48,
                  onPressed: () {
                    _seekTo(_duration);
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
