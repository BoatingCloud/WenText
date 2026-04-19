import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 字体大小枚举
enum FontSize {
  small('小', 0.9),
  medium('中', 1.0),
  large('大', 1.1);

  final String label;
  final double scale;

  const FontSize(this.label, this.scale);
}

/// 字体大小Provider
final fontSizeProvider = StateNotifierProvider<FontSizeNotifier, FontSize>(
  (ref) => FontSizeNotifier(),
);

/// 字体大小状态管理
class FontSizeNotifier extends StateNotifier<FontSize> {
  static const String _key = 'font_size';

  FontSizeNotifier() : super(FontSize.medium) {
    _loadFontSize();
  }

  /// 加载字体大小
  Future<void> _loadFontSize() async {
    final prefs = await SharedPreferences.getInstance();
    final fontSizeString = prefs.getString(_key);
    if (fontSizeString != null) {
      state = FontSize.values.firstWhere(
        (size) => size.name == fontSizeString,
        orElse: () => FontSize.medium,
      );
    }
  }

  /// 设置字体大小
  Future<void> setFontSize(FontSize size) async {
    state = size;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, size.name);
  }
}
