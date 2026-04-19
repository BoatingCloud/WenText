import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:dio/dio.dart';
import 'dart:typed_data';
import '../../../core/network/api_client.dart';

/// 图片预览页面（增强版）
class ImagePreviewScreen extends StatefulWidget {
  final String imageUrl;
  final String title;

  const ImagePreviewScreen({
    super.key,
    required this.imageUrl,
    required this.title,
  });

  @override
  State<ImagePreviewScreen> createState() => _ImagePreviewScreenState();
}

class _ImagePreviewScreenState extends State<ImagePreviewScreen> {
  final TransformationController _transformationController = TransformationController();
  bool _showControls = true;
  int _rotationAngle = 0; // 0, 90, 180, 270
  bool _isLoading = true;
  String? _error;
  Uint8List? _imageBytes;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  Future<void> _loadImage() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final dio = ApiClient().mainDio;
      final response = await dio.get(
        widget.imageUrl,
        options: Options(
          responseType: ResponseType.bytes,
        ),
      );

      if (mounted) {
        setState(() {
          _imageBytes = Uint8List.fromList(response.data);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '加载图片失败: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  void _resetZoom() {
    _transformationController.value = Matrix4.identity();
  }

  void _rotate() {
    setState(() {
      _rotationAngle = (_rotationAngle + 90) % 360;
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
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
                  icon: const Icon(Symbols.refresh),
                  onPressed: _loadImage,
                  tooltip: '重新加载',
                ),
                IconButton(
                  icon: const Icon(Symbols.rotate_right),
                  onPressed: _rotate,
                  tooltip: '旋转',
                ),
                IconButton(
                  icon: const Icon(Symbols.download),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('下载功能开发中')),
                    );
                  },
                  tooltip: '下载',
                ),
              ],
            )
          : null,
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Symbols.broken_image,
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
              onPressed: _loadImage,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_imageBytes == null) {
      return const Center(
        child: Text(
          '无法加载图片',
          style: TextStyle(color: Colors.white54),
        ),
      );
    }

    return GestureDetector(
      onTap: _toggleControls,
      onDoubleTap: () {
        // 双击缩放
        if (_transformationController.value.getMaxScaleOnAxis() > 1.5) {
          _resetZoom();
        } else {
          _transformationController.value = Matrix4.identity()..scale(2.0);
        }
      },
      child: Center(
        child: InteractiveViewer(
          transformationController: _transformationController,
          minScale: 0.5,
          maxScale: 4.0,
          child: RotatedBox(
            quarterTurns: _rotationAngle ~/ 90,
            child: Image.memory(_imageBytes!),
          ),
        ),
      ),
    );
  }
}
