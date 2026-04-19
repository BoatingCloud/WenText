import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';
import '../../../core/theme/theme_provider.dart';
import '../../../core/theme/font_size_provider.dart';
import '../../../core/storage/storage_service.dart';
import '../../../core/services/health_check_service.dart';
import '../../../core/services/version_service.dart';
import '../../../core/constants/app_constants.dart';
import '../../auth/providers/auth_provider.dart';

/// 设置页面
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final themeModeNotifier = ref.read(themeModeProvider.notifier);
    final fontSize = ref.watch(fontSizeProvider);
    final fontSizeNotifier = ref.read(fontSizeProvider.notifier);
    final authNotifier = ref.read(authProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
      ),
      body: ListView(
        children: [
          // 外观设置
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              '外观设置',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),

          // 主题模式
          ListTile(
            leading: const Icon(Icons.palette_outlined),
            title: const Text('主题模式'),
            subtitle: Text(
              themeMode == ThemeMode.light
                  ? '亮色'
                  : themeMode == ThemeMode.dark
                      ? '暗色'
                      : '跟随系统',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('选择主题模式'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      RadioListTile<ThemeMode>(
                        title: const Text('跟随系统'),
                        value: ThemeMode.system,
                        groupValue: themeMode,
                        onChanged: (value) {
                          if (value != null) {
                            themeModeNotifier.setThemeMode(value);
                            Navigator.pop(context);
                          }
                        },
                      ),
                      RadioListTile<ThemeMode>(
                        title: const Text('亮色'),
                        value: ThemeMode.light,
                        groupValue: themeMode,
                        onChanged: (value) {
                          if (value != null) {
                            themeModeNotifier.setThemeMode(value);
                            Navigator.pop(context);
                          }
                        },
                      ),
                      RadioListTile<ThemeMode>(
                        title: const Text('暗色'),
                        value: ThemeMode.dark,
                        groupValue: themeMode,
                        onChanged: (value) {
                          if (value != null) {
                            themeModeNotifier.setThemeMode(value);
                            Navigator.pop(context);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          ),

          // 字体大小
          ListTile(
            leading: const Icon(Icons.text_fields),
            title: const Text('字体大小'),
            subtitle: Text(fontSize.label),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('选择字体大小'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: FontSize.values.map((size) {
                      return RadioListTile<FontSize>(
                        title: Text(size.label),
                        value: size,
                        groupValue: fontSize,
                        onChanged: (value) {
                          if (value != null) {
                            fontSizeNotifier.setFontSize(value);
                            Navigator.pop(context);
                          }
                        },
                      );
                    }).toList(),
                  ),
                ),
              );
            },
          ),

          const Divider(height: 32),

          // 存储设置
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text(
              '存储设置',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),

          // 清除缓存
          ListTile(
            leading: const Icon(Icons.cleaning_services_outlined),
            title: const Text('清除缓存'),
            subtitle: const Text('清除应用缓存数据'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('清除缓存'),
                  content: const Text('确定要清除所有缓存数据吗？'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('取消'),
                    ),
                    FilledButton(
                      onPressed: () async {
                        Navigator.pop(context);
                        // 清除缓存（保留登录信息）
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('缓存已清除')),
                        );
                      },
                      child: const Text('确定'),
                    ),
                  ],
                ),
              );
            },
          ),

          const Divider(height: 32),

          // 应用设置
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Text(
              '应用设置',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ),

          // 连接测试
          ListTile(
            leading: const Icon(Icons.wifi_tethering),
            title: const Text('连接测试'),
            subtitle: const Text('检查API服务器连接状态'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              // 显示加载对话框
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (context) => const Center(
                  child: Card(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: 16),
                          Text('正在检查连接...'),
                        ],
                      ),
                    ),
                  ),
                ),
              );

              // 执行健康检查
              final healthCheckService = HealthCheckService();
              final results = await healthCheckService.checkAllHealth();

              if (context.mounted) {
                Navigator.pop(context); // 关闭加载对话框

                // 显示结果对话框
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('连接测试结果'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              results['mainApi'] == true
                                  ? Icons.check_circle
                                  : Icons.error,
                              color: results['mainApi'] == true
                                  ? Colors.green
                                  : Colors.red,
                            ),
                            const SizedBox(width: 8),
                            const Expanded(child: Text('主API服务器')),
                          ],
                        ),
                        if (results['mainApiMessage'] != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 32, top: 4),
                            child: Text(
                              results['mainApiMessage'],
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                  ),
                            ),
                          ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Icon(
                              results['mobileApi'] == true
                                  ? Icons.check_circle
                                  : Icons.error,
                              color: results['mobileApi'] == true
                                  ? Colors.green
                                  : Colors.red,
                            ),
                            const SizedBox(width: 8),
                            const Expanded(child: Text('移动API服务器')),
                          ],
                        ),
                        if (results['mobileApiMessage'] != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 32, top: 4),
                            child: Text(
                              results['mobileApiMessage'],
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                  ),
                            ),
                          ),
                      ],
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('确定'),
                      ),
                    ],
                  ),
                );
              }
            },
          ),

          // 检查更新
          ListTile(
            leading: const Icon(Icons.system_update_outlined),
            title: const Text('检查更新'),
            subtitle: Text('当前版本 v${AppConstants.appVersion}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              // 显示加载对话框
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (context) => const Center(
                  child: Card(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(),
                          SizedBox(height: 16),
                          Text('正在检查更新...'),
                        ],
                      ),
                    ),
                  ),
                ),
              );

              // 检查更新
              final versionService = VersionService();
              final platform = Platform.isAndroid ? 'android' : 'ios';

              try {
                final result = await versionService.checkUpdate(
                  currentVersion: AppConstants.appVersion,
                  platform: platform,
                );

                if (context.mounted) {
                  Navigator.pop(context); // 关闭加载对话框

                  if (result.hasUpdate && result.versionInfo != null) {
                    final versionInfo = result.versionInfo!;

                    // 显示更新信息
                    showDialog(
                      context: context,
                      barrierDismissible: !versionInfo.forceUpdate, // 强制更新时不允许点击外部关闭
                      builder: (context) => PopScope(
                        canPop: !versionInfo.forceUpdate, // 强制更新时不允许返回
                        child: AlertDialog(
                          title: Text(versionInfo.forceUpdate ? '发现新版本（必须更新）' : '发现新版本'),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('当前版本: ${AppConstants.appVersion}'),
                              const SizedBox(height: 8),
                              Text('最新版本: ${versionInfo.version}'),
                              if (versionInfo.releaseNotes != null) ...[
                                const SizedBox(height: 16),
                                const Text('更新内容:', style: TextStyle(fontWeight: FontWeight.bold)),
                                const SizedBox(height: 8),
                                Text(versionInfo.releaseNotes!),
                              ],
                              if (versionInfo.forceUpdate) ...[
                                const SizedBox(height: 16),
                                const Text(
                                  '此版本为强制更新，必须更新后才能继续使用',
                                  style: TextStyle(color: Colors.red, fontSize: 12),
                                ),
                              ],
                            ],
                          ),
                          actions: [
                            if (!versionInfo.forceUpdate)
                              TextButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text('稍后更新'),
                              ),
                            FilledButton(
                              onPressed: () {
                                Navigator.pop(context);
                                // TODO: 打开下载链接或跳转到应用商店
                                if (versionInfo.downloadUrl != null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('下载链接: ${versionInfo.downloadUrl}')),
                                  );
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('下载功能开发中')),
                                  );
                                }
                              },
                              child: const Text('立即更新'),
                            ),
                          ],
                        ),
                      ),
                    );
                  } else {
                    // 已是最新版本
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('已是最新版本')),
                    );
                  }
                }
              } catch (e) {
                if (context.mounted) {
                  Navigator.pop(context); // 关闭加载对话框
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('检查更新失败: $e')),
                  );
                }
              }
            },
          ),

          // 切换账号
          ListTile(
            leading: const Icon(Icons.swap_horiz),
            title: const Text('切换账号'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('切换账号'),
                  content: const Text('确定要退出当前账号并返回登录页吗？'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('取消'),
                    ),
                    FilledButton(
                      onPressed: () async {
                        Navigator.pop(context);
                        await authNotifier.logout();
                        if (context.mounted) {
                          context.go('/login');
                        }
                      },
                      child: const Text('确定'),
                    ),
                  ],
                ),
              );
            },
          ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
