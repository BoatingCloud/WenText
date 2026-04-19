/// 分享链接
class ShareLink {
  final String id;
  final String documentId;
  final String code;
  final String shareType; // PUBLIC, PASSWORD, INTERNAL
  final String? password;
  final List<String> permissions;
  final DateTime? expiresAt;
  final int? maxViews;
  final int viewCount;
  final String status; // ACTIVE, EXPIRED, DISABLED
  final DateTime createdAt;
  final String? createdBy;

  ShareLink({
    required this.id,
    required this.documentId,
    required this.code,
    required this.shareType,
    this.password,
    required this.permissions,
    this.expiresAt,
    this.maxViews,
    required this.viewCount,
    required this.status,
    required this.createdAt,
    this.createdBy,
  });

  factory ShareLink.fromJson(Map<String, dynamic> json) {
    // 解析权限列表
    List<String> permissions = [];
    if (json['permissions'] != null && json['permissions'] is List) {
      permissions = (json['permissions'] as List).map((e) => e.toString()).toList();
    }

    // 安全解析创建者
    String? createdBy;
    if (json['creator'] != null && json['creator'] is Map) {
      final creator = json['creator'] as Map<String, dynamic>;
      createdBy = creator['name'] ?? creator['username'];
    }

    return ShareLink(
      id: json['id'] ?? '',
      documentId: json['documentId'] ?? '',
      code: json['code'] ?? '',
      shareType: json['shareType'] ?? 'PUBLIC',
      password: json['password'],
      permissions: permissions,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : null,
      maxViews: json['maxViews'],
      viewCount: json['viewCount'] ?? 0,
      status: json['status'] ?? 'ACTIVE',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      createdBy: createdBy,
    );
  }

  /// 获取分享链接URL
  String getShareUrl(String baseUrl) {
    return '$baseUrl/share/$code';
  }

  /// 是否已过期
  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// 是否达到访问次数限制
  bool get isViewLimitReached {
    if (maxViews == null) return false;
    return viewCount >= maxViews!;
  }

  /// 获取状态文本
  String getStatusText() {
    if (status == 'DISABLED') return '已禁用';
    if (status == 'EXPIRED' || isExpired) return '已过期';
    if (isViewLimitReached) return '已达访问上限';
    return '有效';
  }

  /// 格式化过期时间
  String getFormattedExpiresAt() {
    if (expiresAt == null) return '永久有效';
    return '${expiresAt!.year}-${expiresAt!.month.toString().padLeft(2, '0')}-${expiresAt!.day.toString().padLeft(2, '0')} '
        '${expiresAt!.hour.toString().padLeft(2, '0')}:${expiresAt!.minute.toString().padLeft(2, '0')}';
  }

  /// 格式化访问次数
  String getFormattedViewCount() {
    if (maxViews == null) {
      return '$viewCount 次';
    }
    return '$viewCount / $maxViews 次';
  }
}
