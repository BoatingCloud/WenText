import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 本地存储服务
class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  late Box _box;
  late SharedPreferences _prefs;

  /// 初始化存储
  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox('wenyu_storage');
    _prefs = await SharedPreferences.getInstance();
  }

  /// 保存数据到Hive
  Future<void> saveToHive(String key, dynamic value) async {
    await _box.put(key, value);
  }

  /// 从Hive读取数据
  dynamic getFromHive(String key, {dynamic defaultValue}) {
    return _box.get(key, defaultValue: defaultValue);
  }

  /// 从Hive删除数据
  Future<void> deleteFromHive(String key) async {
    await _box.delete(key);
  }

  /// 清空Hive
  Future<void> clearHive() async {
    await _box.clear();
  }

  /// 保存数据到SharedPreferences
  Future<bool> saveToPrefs(String key, dynamic value) async {
    if (value is String) {
      return await _prefs.setString(key, value);
    } else if (value is int) {
      return await _prefs.setInt(key, value);
    } else if (value is double) {
      return await _prefs.setDouble(key, value);
    } else if (value is bool) {
      return await _prefs.setBool(key, value);
    } else if (value is List<String>) {
      return await _prefs.setStringList(key, value);
    }
    return false;
  }

  /// 从SharedPreferences读取数据
  dynamic getFromPrefs(String key) {
    return _prefs.get(key);
  }

  /// 从SharedPreferences删除数据
  Future<bool> deleteFromPrefs(String key) async {
    return await _prefs.remove(key);
  }

  /// 清空SharedPreferences
  Future<bool> clearPrefs() async {
    return await _prefs.clear();
  }

  /// 清空所有存储
  Future<void> clearAll() async {
    await clearHive();
    await clearPrefs();
  }
}
