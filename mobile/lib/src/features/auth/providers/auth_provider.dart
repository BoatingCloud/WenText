import 'dart:convert';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/storage/storage_service.dart';
import '../models/user.dart';
import '../models/login_response.dart';
import 'auth_service.dart';

/// 认证状态
class AuthState {
  final bool isAuthenticated;
  final User? user;
  final String? token;
  final String? refreshToken;
  final bool isLoading;
  final String? error;

  AuthState({
    this.isAuthenticated = false,
    this.user,
    this.token,
    this.refreshToken,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    User? user,
    String? token,
    String? refreshToken,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      token: token ?? this.token,
      refreshToken: refreshToken ?? this.refreshToken,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 认证Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

/// 认证状态管理
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService = AuthService();
  final StorageService _storage = StorageService();

  AuthNotifier() : super(AuthState()) {
    _checkAuthStatus();
  }

  /// 检查认证状态
  Future<void> _checkAuthStatus() async {
    final token = _storage.getFromHive(AppConstants.tokenKey);
    final userJson = _storage.getFromHive(AppConstants.userInfoKey);

    if (token != null && userJson != null) {
      try {
        // 验证 Token 有效性
        final response = await _authService.getCurrentUser();
        if (response.success && response.data != null) {
          // Token 有效，使用服务器返回的最新用户信息
          await _storage.saveToHive(
            AppConstants.userInfoKey,
            jsonEncode(response.data!.toJson()),
          );
          state = state.copyWith(
            isAuthenticated: true,
            user: response.data,
            token: token,
          );
        } else {
          // Token 无效，清除本地数据
          await _clearAuthData();
        }
      } catch (e) {
        // 网络错误或其他异常，使用本地缓存的用户信息
        try {
          final user = User.fromJson(jsonDecode(userJson));
          state = state.copyWith(
            isAuthenticated: true,
            user: user,
            token: token,
          );
        } catch (e) {
          await _clearAuthData();
        }
      }
    }
  }

  /// 登录
  Future<bool> login({
    required String username,
    required String password,
    bool rememberPassword = false,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      print('AuthProvider: 开始登录, username=$username');
      final response = await _authService.login(
        username: username,
        password: password,
      );

      print('AuthProvider: 登录响应 success=${response.success}');

      if (response.success && response.data != null) {
        final loginData = response.data!;
        print('AuthProvider: 登录成功');
        print('AuthProvider: accessToken 长度: ${loginData.accessToken.length}');
        print('AuthProvider: accessToken 前30字符: ${loginData.accessToken.substring(0, loginData.accessToken.length > 30 ? 30 : loginData.accessToken.length)}...');
        print('AuthProvider: 用户信息: ${loginData.user.name} (${loginData.user.username})');

        // 保存认证信息
        print('AuthProvider: 开始保存 token 到 Hive');
        await _storage.saveToHive(AppConstants.tokenKey, loginData.accessToken);
        print('AuthProvider: Token 已保存');

        // 验证保存是否成功
        final savedToken = _storage.getFromHive(AppConstants.tokenKey);
        print('AuthProvider: 验证保存的 token: ${savedToken != null ? "存在" : "不存在"}');
        if (savedToken != null) {
          print('AuthProvider: 保存的 token 长度: ${savedToken.toString().length}');
          print('AuthProvider: 保存的 token 前30字符: ${savedToken.toString().substring(0, savedToken.toString().length > 30 ? 30 : savedToken.toString().length)}...');
        }

        await _storage.saveToHive(
          AppConstants.userInfoKey,
          jsonEncode(loginData.user.toJson()),
        );
        print('AuthProvider: 用户信息已保存');

        // 保存记住密码
        if (rememberPassword) {
          await _storage.saveToPrefs(AppConstants.rememberPasswordKey, true);
          await _storage.saveToPrefs(AppConstants.usernameKey, username);
          await _storage.saveToPrefs(AppConstants.passwordKey, password);
          print('AuthProvider: 记住密码已保存');
        } else {
          await _storage.deleteFromPrefs(AppConstants.rememberPasswordKey);
          await _storage.deleteFromPrefs(AppConstants.usernameKey);
          await _storage.deleteFromPrefs(AppConstants.passwordKey);
        }

        state = state.copyWith(
          isAuthenticated: true,
          user: loginData.user,
          token: loginData.accessToken,
          refreshToken: loginData.refreshToken,
          isLoading: false,
        );

        print('AuthProvider: 登录流程完成');
        return true;
      } else {
        print('AuthProvider: 登录失败: ${response.message}');
        state = state.copyWith(
          isLoading: false,
          error: response.message ?? '登录失败',
        );
        return false;
      }
    } catch (e, stackTrace) {
      print('AuthProvider: 登录异常: $e');
      print('AuthProvider: 堆栈跟踪: $stackTrace');
      state = state.copyWith(
        isLoading: false,
        error: '登录失败: $e',
      );
      return false;
    }
  }

  /// 登出
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);

    try {
      await _authService.logout();
    } catch (e) {
      // 忽略登出错误，继续清除本地数据
    }

    await _clearAuthData();

    state = AuthState();
  }

  /// 清除认证数据
  Future<void> _clearAuthData() async {
    await _storage.deleteFromHive(AppConstants.tokenKey);
    await _storage.deleteFromHive(AppConstants.userInfoKey);
  }

  /// 获取记住的密码
  Map<String, String>? getRememberedCredentials() {
    final rememberPassword = _storage.getFromPrefs(AppConstants.rememberPasswordKey);
    if (rememberPassword == true) {
      final username = _storage.getFromPrefs(AppConstants.usernameKey);
      final password = _storage.getFromPrefs(AppConstants.passwordKey);
      if (username != null && password != null) {
        return {
          'username': username,
          'password': password,
        };
      }
    }
    return null;
  }
}
