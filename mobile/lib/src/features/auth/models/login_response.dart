import 'user.dart';

/// Token 对
class TokenPair {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  TokenPair({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  factory TokenPair.fromJson(Map<String, dynamic> json) {
    return TokenPair(
      accessToken: json['accessToken'] ?? '',
      refreshToken: json['refreshToken'] ?? '',
      expiresIn: json['expiresIn'] ?? 7200,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresIn': expiresIn,
    };
  }
}

/// 登录响应模型
class LoginResponse {
  final User user;
  final TokenPair tokens;

  LoginResponse({
    required this.user,
    required this.tokens,
  });

  // 为了兼容旧代码，提供便捷访问器
  String get accessToken => tokens.accessToken;
  String get refreshToken => tokens.refreshToken;
  int get expiresIn => tokens.expiresIn;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      user: User.fromJson(json['user'] ?? {}),
      tokens: TokenPair.fromJson(json['tokens'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user': user.toJson(),
      'tokens': tokens.toJson(),
    };
  }
}
