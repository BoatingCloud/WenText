import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../models/share_link.dart';
import '../services/share_service.dart';

/// 分享对话框
class ShareDialog extends StatefulWidget {
  final String fileId;
  final String fileName;

  const ShareDialog({
    super.key,
    required this.fileId,
    required this.fileName,
  });

  @override
  State<ShareDialog> createState() => _ShareDialogState();
}

class _ShareDialogState extends State<ShareDialog> {
  final ShareService _shareService = ShareService();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _maxViewsController = TextEditingController();

  bool _isLoading = false;
  bool _usePassword = false;
  bool _useExpiration = false;
  bool _useMaxViews = false;
  DateTime? _expirationDate;
  ShareLink? _createdShareLink;

  @override
  void dispose() {
    _passwordController.dispose();
    _maxViewsController.dispose();
    super.dispose();
  }

  Future<void> _createShareLink() async {
    setState(() {
      _isLoading = true;
    });

    final response = await _shareService.createShareLink(
      fileId: widget.fileId,
      password: _usePassword ? _passwordController.text : null,
      expiresAt: _useExpiration ? _expirationDate : null,
      maxViews: _useMaxViews
          ? int.tryParse(_maxViewsController.text)
          : null,
    );

    if (mounted) {
      setState(() {
        _isLoading = false;
      });

      if (response.success && response.data != null) {
        setState(() {
          _createdShareLink = response.data;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response.message ?? '创建分享链接失败')),
        );
      }
    }
  }

  Future<void> _selectExpirationDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expirationDate ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );

    if (picked != null) {
      final time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(_expirationDate ?? now),
      );

      if (time != null && mounted) {
        setState(() {
          _expirationDate = DateTime(
            picked.year,
            picked.month,
            picked.day,
            time.hour,
            time.minute,
          );
        });
      }
    }
  }

  void _copyShareLink() {
    if (_createdShareLink != null) {
      // TODO: 获取实际的 baseUrl
      final shareUrl = _createdShareLink!.getShareUrl('https://example.com');
      Clipboard.setData(ClipboardData(text: shareUrl));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('分享链接已复制到剪贴板')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 标题栏
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(28),
                  topRight: Radius.circular(28),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Symbols.share,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '分享文件',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Symbols.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            // 内容
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: _createdShareLink == null
                    ? _buildCreateForm()
                    : _buildShareLinkResult(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCreateForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.fileName,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 24),
        // 密码保护
        SwitchListTile(
          title: const Text('密码保护'),
          subtitle: const Text('需要密码才能访问'),
          value: _usePassword,
          onChanged: (value) {
            setState(() {
              _usePassword = value;
            });
          },
        ),
        if (_usePassword) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _passwordController,
            decoration: const InputDecoration(
              labelText: '密码',
              hintText: '请输入访问密码',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Symbols.lock),
            ),
            obscureText: true,
          ),
        ],
        const SizedBox(height: 16),
        // 过期时间
        SwitchListTile(
          title: const Text('设置过期时间'),
          subtitle: _expirationDate != null
              ? Text('过期时间: ${_formatDateTime(_expirationDate!)}')
              : const Text('永久有效'),
          value: _useExpiration,
          onChanged: (value) {
            setState(() {
              _useExpiration = value;
              if (value && _expirationDate == null) {
                _expirationDate = DateTime.now().add(const Duration(days: 7));
              }
            });
          },
        ),
        if (_useExpiration) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _selectExpirationDate,
            icon: const Icon(Symbols.calendar_today),
            label: Text(
              _expirationDate != null
                  ? _formatDateTime(_expirationDate!)
                  : '选择过期时间',
            ),
          ),
        ],
        const SizedBox(height: 16),
        // 访问次数限制
        SwitchListTile(
          title: const Text('限制访问次数'),
          subtitle: const Text('达到次数后链接失效'),
          value: _useMaxViews,
          onChanged: (value) {
            setState(() {
              _useMaxViews = value;
            });
          },
        ),
        if (_useMaxViews) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _maxViewsController,
            decoration: const InputDecoration(
              labelText: '最大访问次数',
              hintText: '请输入最大访问次数',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Symbols.visibility),
            ),
            keyboardType: TextInputType.number,
          ),
        ],
        const SizedBox(height: 24),
        // 创建按钮
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _isLoading ? null : _createShareLink,
            icon: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Symbols.share),
            label: Text(_isLoading ? '创建中...' : '创建分享链接'),
          ),
        ),
      ],
    );
  }

  Widget _buildShareLinkResult() {
    final shareUrl = _createdShareLink!.getShareUrl('https://example.com');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Icon(
                Symbols.check_circle,
                color: Theme.of(context).colorScheme.primary,
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '分享链接已创建',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '点击下方链接复制',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // 分享链接
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(
              color: Theme.of(context).colorScheme.outline,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Expanded(
                child: SelectableText(
                  shareUrl,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontFamily: 'monospace',
                      ),
                ),
              ),
              IconButton(
                icon: const Icon(Symbols.content_copy),
                onPressed: _copyShareLink,
                tooltip: '复制链接',
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // 分享码
        _buildInfoRow('分享码', _createdShareLink!.code),
        if (_createdShareLink!.password != null)
          _buildInfoRow('访问密码', _createdShareLink!.password!),
        _buildInfoRow('过期时间', _createdShareLink!.getFormattedExpiresAt()),
        if (_createdShareLink!.maxViews != null)
          _buildInfoRow('访问限制', _createdShareLink!.getFormattedViewCount()),
        const SizedBox(height: 24),
        // 关闭按钮
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('完成'),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}
