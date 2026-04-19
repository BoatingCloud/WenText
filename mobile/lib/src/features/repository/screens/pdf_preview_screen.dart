import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../../../core/network/api_client.dart';

/// PDF预览页面
class PdfPreviewScreen extends StatefulWidget {
  final String fileUrl;
  final String title;

  const PdfPreviewScreen({
    super.key,
    required this.fileUrl,
    required this.title,
  });

  @override
  State<PdfPreviewScreen> createState() => _PdfPreviewScreenState();
}

class _PdfPreviewScreenState extends State<PdfPreviewScreen> {
  bool _isLoading = true;
  String? _localPath;
  String? _error;
  int _currentPage = 0;
  int _totalPages = 0;
  PDFViewController? _pdfViewController;

  @override
  void initState() {
    super.initState();
    _downloadAndLoadPdf();
  }

  Future<void> _downloadAndLoadPdf() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final dio = ApiClient().mainDio;
      final directory = await getTemporaryDirectory();
      final fileName = 'temp_${DateTime.now().millisecondsSinceEpoch}.pdf';
      final filePath = '${directory.path}/$fileName';

      await dio.download(
        widget.fileUrl,
        filePath,
      );

      setState(() {
        _localPath = filePath;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = '加载PDF失败: $e';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    // 清理临时文件
    if (_localPath != null) {
      try {
        File(_localPath!).delete();
      } catch (e) {
        print('删除临时文件失败: $e');
      }
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (_totalPages > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  '${_currentPage + 1}/$_totalPages',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
            ),
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
      floatingActionButton: _localPath != null
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FloatingActionButton(
                  heroTag: 'prev',
                  mini: true,
                  onPressed: _currentPage > 0
                      ? () {
                          _pdfViewController?.setPage(_currentPage - 1);
                        }
                      : null,
                  child: const Icon(Symbols.arrow_upward),
                ),
                const SizedBox(height: 8),
                FloatingActionButton(
                  heroTag: 'next',
                  mini: true,
                  onPressed: _currentPage < _totalPages - 1
                      ? () {
                          _pdfViewController?.setPage(_currentPage + 1);
                        }
                      : null,
                  child: const Icon(Symbols.arrow_downward),
                ),
              ],
            )
          : null,
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('正在加载PDF...'),
          ],
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
              onPressed: _downloadAndLoadPdf,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_localPath == null) {
      return const Center(child: Text('无法加载PDF'));
    }

    return PDFView(
      filePath: _localPath!,
      enableSwipe: true,
      swipeHorizontal: false,
      autoSpacing: true,
      pageFling: true,
      pageSnap: true,
      onRender: (pages) {
        setState(() {
          _totalPages = pages ?? 0;
        });
      },
      onViewCreated: (controller) {
        _pdfViewController = controller;
      },
      onPageChanged: (page, total) {
        setState(() {
          _currentPage = page ?? 0;
          _totalPages = total ?? 0;
        });
      },
      onError: (error) {
        setState(() {
          _error = '渲染PDF失败: $error';
        });
      },
    );
  }
}
