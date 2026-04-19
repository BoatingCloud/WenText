import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';

/// 文本预览页面（增强版）
class TextPreviewScreen extends StatefulWidget {
  final String fileUrl;
  final String title;

  const TextPreviewScreen({
    super.key,
    required this.fileUrl,
    required this.title,
  });

  @override
  State<TextPreviewScreen> createState() => _TextPreviewScreenState();
}

class _TextPreviewScreenState extends State<TextPreviewScreen> {
  bool _isLoading = true;
  String? _content;
  String? _error;
  double _fontSize = 14.0;
  bool _showLineNumbers = false;
  bool _wordWrap = true;

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final dio = ApiClient().mainDio;
      final response = await dio.get(
        widget.fileUrl,
        options: Options(
          responseType: ResponseType.plain,
        ),
      );

      setState(() {
        _content = response.data.toString();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = '加载文件失败: $e';
        _isLoading = false;
      });
    }
  }

  void _increaseFontSize() {
    setState(() {
      _fontSize = (_fontSize + 2).clamp(10, 24);
    });
  }

  void _decreaseFontSize() {
    setState(() {
      _fontSize = (_fontSize - 2).clamp(10, 24);
    });
  }

  void _toggleLineNumbers() {
    setState(() {
      _showLineNumbers = !_showLineNumbers;
    });
  }

  void _toggleWordWrap() {
    setState(() {
      _wordWrap = !_wordWrap;
    });
  }

  void _copyToClipboard() {
    if (_content != null) {
      Clipboard.setData(ClipboardData(text: _content!));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('已复制到剪贴板')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            icon: const Icon(Symbols.text_decrease),
            onPressed: _decreaseFontSize,
            tooltip: '减小字体',
          ),
          IconButton(
            icon: const Icon(Symbols.text_increase),
            onPressed: _increaseFontSize,
            tooltip: '增大字体',
          ),
          IconButton(
            icon: Icon(_showLineNumbers ? Symbols.format_list_numbered : Symbols.format_list_numbered,
                      fill: _showLineNumbers ? 1 : 0),
            onPressed: _toggleLineNumbers,
            tooltip: '行号',
          ),
          IconButton(
            icon: Icon(_wordWrap ? Symbols.wrap_text : Symbols.wrap_text,
                      fill: _wordWrap ? 1 : 0),
            onPressed: _toggleWordWrap,
            tooltip: '自动换行',
          ),
          PopupMenuButton(
            itemBuilder: (context) => [
              PopupMenuItem(
                onTap: _copyToClipboard,
                child: const Row(
                  children: [
                    Icon(Symbols.content_copy),
                    SizedBox(width: 12),
                    Text('复制全部'),
                  ],
                ),
              ),
              PopupMenuItem(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('下载功能开发中')),
                  );
                },
                child: const Row(
                  children: [
                    Icon(Symbols.download),
                    SizedBox(width: 12),
                    Text('下载'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
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
              onPressed: _loadContent,
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }

    if (_content == null) {
      return const Center(child: Text('无内容'));
    }

    final lines = _content!.split('\n');

    return SingleChildScrollView(
      scrollDirection: _wordWrap ? Axis.vertical : Axis.vertical,
      child: SingleChildScrollView(
        scrollDirection: _wordWrap ? Axis.vertical : Axis.horizontal,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _showLineNumbers
              ? _buildWithLineNumbers(lines)
              : SelectableText(
                  _content!,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: _fontSize,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildWithLineNumbers(List<String> lines) {
    final lineNumberWidth = (lines.length.toString().length * 8.0) + 16;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 行号列
        Container(
          width: lineNumberWidth,
          padding: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            border: Border(
              right: BorderSide(
                color: Theme.of(context).colorScheme.outlineVariant,
                width: 1,
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(
              lines.length,
              (index) => Text(
                '${index + 1}',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: _fontSize,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // 内容列
        Expanded(
          child: SelectableText(
            _content!,
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: _fontSize,
            ),
          ),
        ),
      ],
    );
  }
}
