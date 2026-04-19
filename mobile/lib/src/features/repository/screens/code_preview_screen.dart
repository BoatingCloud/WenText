import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:dio/dio.dart';
import 'package:flutter_highlight/flutter_highlight.dart';
import 'package:flutter_highlight/themes/github.dart';
import 'package:flutter_highlight/themes/monokai-sublime.dart';
import '../../../core/network/api_client.dart';

/// 代码文件预览页面（带语法高亮）
class CodePreviewScreen extends StatefulWidget {
  final String fileUrl;
  final String title;
  final String? language; // 编程语言，用于语法高亮

  const CodePreviewScreen({
    super.key,
    required this.fileUrl,
    required this.title,
    this.language,
  });

  @override
  State<CodePreviewScreen> createState() => _CodePreviewScreenState();
}

class _CodePreviewScreenState extends State<CodePreviewScreen> {
  bool _isLoading = true;
  String? _content;
  String? _error;
  double _fontSize = 14.0;
  bool _showLineNumbers = true;
  bool _isDarkTheme = false;

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

  void _toggleTheme() {
    setState(() {
      _isDarkTheme = !_isDarkTheme;
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

  String _getLanguageFromExtension() {
    if (widget.language != null) return widget.language!;

    final fileName = widget.title.toLowerCase();
    if (fileName.endsWith('.dart')) return 'dart';
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.ts')) return 'typescript';
    if (fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.java')) return 'java';
    if (fileName.endsWith('.kt')) return 'kotlin';
    if (fileName.endsWith('.swift')) return 'swift';
    if (fileName.endsWith('.go')) return 'go';
    if (fileName.endsWith('.rs')) return 'rust';
    if (fileName.endsWith('.c')) return 'c';
    if (fileName.endsWith('.cpp') || fileName.endsWith('.cc')) return 'cpp';
    if (fileName.endsWith('.h')) return 'c';
    if (fileName.endsWith('.cs')) return 'csharp';
    if (fileName.endsWith('.php')) return 'php';
    if (fileName.endsWith('.rb')) return 'ruby';
    if (fileName.endsWith('.sh')) return 'bash';
    if (fileName.endsWith('.sql')) return 'sql';
    if (fileName.endsWith('.html')) return 'xml';
    if (fileName.endsWith('.xml')) return 'xml';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.scss')) return 'scss';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
    return 'plaintext';
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
            icon: Icon(
              _showLineNumbers ? Symbols.format_list_numbered : Symbols.format_list_numbered,
              fill: _showLineNumbers ? 1 : 0,
            ),
            onPressed: _toggleLineNumbers,
            tooltip: '行号',
          ),
          IconButton(
            icon: Icon(
              _isDarkTheme ? Symbols.light_mode : Symbols.dark_mode,
            ),
            onPressed: _toggleTheme,
            tooltip: '切换主题',
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

    return SingleChildScrollView(
      child: _showLineNumbers
          ? _buildWithLineNumbers()
          : _buildWithoutLineNumbers(),
    );
  }

  Widget _buildWithLineNumbers() {
    final lines = _content!.split('\n');
    final lineNumberWidth = (lines.length.toString().length * 8.0) + 16;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 行号列
        Container(
          width: lineNumberWidth,
          color: _isDarkTheme ? Colors.grey[900] : Colors.grey[100],
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(
              lines.length,
              (index) => Text(
                '${index + 1}',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: _fontSize,
                  color: _isDarkTheme ? Colors.grey[500] : Colors.grey[600],
                  height: 1.5,
                ),
              ),
            ),
          ),
        ),
        // 代码列
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Container(
              padding: const EdgeInsets.all(16),
              child: HighlightView(
                _content!,
                language: _getLanguageFromExtension(),
                theme: _isDarkTheme ? monokaiSublimeTheme : githubTheme,
                padding: EdgeInsets.zero,
                textStyle: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: _fontSize,
                  height: 1.5,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWithoutLineNumbers() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        padding: const EdgeInsets.all(16),
        child: HighlightView(
          _content!,
          language: _getLanguageFromExtension(),
          theme: _isDarkTheme ? monokaiSublimeTheme : githubTheme,
          padding: EdgeInsets.zero,
          textStyle: TextStyle(
            fontFamily: 'monospace',
            fontSize: _fontSize,
            height: 1.5,
          ),
        ),
      ),
    );
  }
}
