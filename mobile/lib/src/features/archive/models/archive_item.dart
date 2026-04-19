import 'package:flutter/material.dart';

/// 档案项
class ArchiveItem {
  final String id;
  final String name;
  final String archiveNumber; // 档案编号
  final String? fondName; // 全宗名称
  final String? fondId; // 全宗ID
  final String? category; // 分类
  final String? year; // 年度
  final String? retentionPeriod; // 保管期限
  final String? securityLevel; // 密级
  final String? responsiblePerson; // 责任者
  final DateTime? formationDate; // 形成日期
  final ArchiveStatus status; // 状态
  final String? location; // 存放位置
  final String? department; // 移交部门
  final int? pageCount; // 页数
  final int? copies; // 份数
  final String? fileNumber; // 文件编号
  final String? workflowStatus; // 工作流状态
  final List<String>? attachments; // 附件列表
  final String? thumbnailUrl; // 缩略图URL
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? description; // 描述

  ArchiveItem({
    required this.id,
    required this.name,
    required this.archiveNumber,
    this.fondName,
    this.fondId,
    this.category,
    this.year,
    this.retentionPeriod,
    this.securityLevel,
    this.responsiblePerson,
    this.formationDate,
    required this.status,
    this.location,
    this.department,
    this.pageCount,
    this.copies,
    this.fileNumber,
    this.workflowStatus,
    this.attachments,
    this.thumbnailUrl,
    this.createdAt,
    this.updatedAt,
    this.description,
  });

  factory ArchiveItem.fromJson(Map<String, dynamic> json) {
    try {
      return ArchiveItem(
        id: json['id']?.toString() ?? '',
        name: json['title'] ?? json['name'] ?? '',
        archiveNumber: json['archiveNo'] ?? json['archiveNumber'] ?? json['code'] ?? '',
        fondName: json['fondsName'] ?? json['fondName'] ?? json['fond']?['name'],
        fondId: json['fondsId']?.toString() ??
                json['fondId']?.toString() ??
                json['fond']?['id']?.toString(),
        category: _extractString(json['categoryName']) ?? _extractString(json['category']),
        year: json['year']?.toString(),
        retentionPeriod: _extractString(json['retentionPeriod']),
        securityLevel: _extractString(json['securityLevel']) ??
                       _extractString(json['securityClassification']),
        responsiblePerson: _extractString(json['responsibleParty']) ??
                           _extractString(json['responsiblePerson']) ??
                           _extractString(json['creator']),
        formationDate: json['formedAt'] != null
            ? DateTime.parse(json['formedAt'])
            : (json['formationDate'] != null ? DateTime.parse(json['formationDate']) : null),
        status: _parseStatus(json['workflowStatus'] ?? json['status']),
        location: _extractString(json['storageLocation']) ??
                  _extractString(json['location']) ??
                  _extractString(json['shelfLocation']),
        department: _extractString(json['filingDepartment']) ??
                    _extractString(json['department']) ??
                    _extractString(json['transferDepartment']),
        pageCount: json['pages'] ?? json['pageCount'],
        copies: json['copies'],
        fileNumber: _extractString(json['fileNo']) ?? _extractString(json['fileNumber']),
        workflowStatus: _extractString(json['workflowStatus']),
        attachments: json['attachments'] != null && json['attachments'] is List
            ? (json['attachments'] as List)
                .map((e) => e is String ? e : (e is Map ? (e['url'] ?? e['name'] ?? e['id'])?.toString() : e.toString()))
                .where((e) => e != null)
                .cast<String>()
                .toList()
            : null,
        thumbnailUrl: json['thumbnailUrl'] ?? json['thumbnail'],
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'])
            : null,
        updatedAt: json['updatedAt'] != null
            ? DateTime.parse(json['updatedAt'])
            : null,
        description: _extractString(json['summary']) ?? _extractString(json['description']),
      );
    } catch (e, stackTrace) {
      print('ArchiveItem.fromJson 错误: $e');
      print('JSON 数据: $json');
      print('堆栈: $stackTrace');
      rethrow;
    }
  }

  /// 安全提取字符串值（处理对象类型）
  static String? _extractString(dynamic value) {
    if (value == null) return null;
    if (value is String) return value;
    if (value is Map) return value['name']?.toString() ?? value['id']?.toString();
    return value.toString();
  }

  static ArchiveStatus _parseStatus(dynamic status) {
    if (status == null) return ArchiveStatus.inStorage;

    final statusStr = status.toString().toUpperCase();
    switch (statusStr) {
      case 'IN_STORAGE':
      case 'AVAILABLE':
      case 'ARCHIVED':
      case 'STORED':
        return ArchiveStatus.inStorage;
      case 'BORROWED':
      case 'CHECKED_OUT':
      case 'LENT':
        return ArchiveStatus.borrowed;
      case 'DESTROYED':
      case 'DISPOSED':
        return ArchiveStatus.destroyed;
      default:
        return ArchiveStatus.inStorage;
    }
  }

  /// 获取密级颜色
  Color getSecurityLevelColor() {
    switch (securityLevel?.toLowerCase()) {
      case '绝密':
      case 'top_secret':
        return const Color(0xFFD32F2F); // 红色
      case '机密':
      case 'secret':
        return const Color(0xFFF57C00); // 橙色
      case '秘密':
      case 'confidential':
        return const Color(0xFFFBC02D); // 黄色
      default:
        return const Color(0xFF757575); // 灰色
    }
  }

  /// 获取状态文本
  String getStatusText() {
    switch (status) {
      case ArchiveStatus.inStorage:
        return '在库';
      case ArchiveStatus.borrowed:
        return '借出';
      case ArchiveStatus.destroyed:
        return '已销毁';
    }
  }

  /// 获取状态颜色
  Color getStatusColor() {
    switch (status) {
      case ArchiveStatus.inStorage:
        return const Color(0xFF4CAF50); // 绿色
      case ArchiveStatus.borrowed:
        return const Color(0xFF2196F3); // 蓝色
      case ArchiveStatus.destroyed:
        return const Color(0xFF9E9E9E); // 灰色
    }
  }

  /// 格式化形成日期
  String getFormattedFormationDate() {
    if (formationDate == null) return '-';
    return '${formationDate!.year}-${formationDate!.month.toString().padLeft(2, '0')}-${formationDate!.day.toString().padLeft(2, '0')}';
  }
}

/// 档案状态
enum ArchiveStatus {
  inStorage,  // 在库
  borrowed,   // 借出
  destroyed,  // 已销毁
}
