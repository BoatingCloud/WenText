import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// 应用主题配置
class AppTheme {
  AppTheme._();

  /// 主色调
  static const Color primaryColor = Color(0xFF6750A4);

  /// 亮色主题
  static ThemeData lightTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: Brightness.light,
    ),
    textTheme: GoogleFonts.robotoTextTheme(),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );

  /// 暗色主题
  static ThemeData darkTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      brightness: Brightness.dark,
    ),
    textTheme: GoogleFonts.robotoTextTheme(ThemeData.dark().textTheme),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}
