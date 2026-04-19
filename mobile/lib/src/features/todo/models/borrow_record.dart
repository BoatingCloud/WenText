import 'package:flutter/material.dart';

/// 借阅状态
enum BorrowStatus {
  borrowing, // 借阅中
  returned,  // 已归还
  overdue,   // 逾期
}

/// 借阅记录
class BorrowRecord {
  final String id;
  final String archiveId;
  final String archiveName;
  final String? archiveNumber;
  final String borrowerId;
  final String borrowerName;
  final String? borrowerDepartment;
  final DateTime borrowedAt;
  final DateTime dueAt;
  final DateTime? returnedAt;
  final String? borrowRemark;
  final String? returnRemark;
  final int renewCount;
  final int maxRenewCount;
  final BorrowStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;

  BorrowRecord({
    required this.id,
    required this.archiveId,
    required this.archiveName,
    this.archiveNumber,
    required this.borrowerId,
    required this.borrowerName,
    this.borrowerDepartment,
    required this.borrowedAt,
    required this.dueAt,
    this.returnedAt,
    this.borrowRemark,
    this.returnRemark,
    this.renewCount = 0,
    this.maxRenewCount = 2,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory BorrowRecord.fromJson(Map<String, dynamic> json) {
    return BorrowRecord(
      id: json['id'] as String,
      archiveId: json['archiveId'] as String,
      archiveName: json['archiveName'] as String,
      archiveNumber: json['archiveNumber'] as String?,
      borrowerId: json['borrowerId'] as String,
      borrowerName: json['borrowerName'] as String,
      borrowerDepartment: json['borrowerDepartment'] as String?,
      borrowedAt: DateTime.parse(json['borrowedAt'] as String),
      dueAt: DateTime.parse(json['dueAt'] as String),
      returnedAt: json['returnedAt'] != null
          ? DateTime.parse(json['returnedAt'] as String)
          : null,
      borrowRemark: json['borrowRemark'] as String?,
      returnRemark: json['returnRemark'] as String?,
      renewCount: json['renewCount'] as int? ?? 0,
      maxRenewCount: json['maxRenewCount'] as int? ?? 2,
      status: _parseBorrowStatus(json['status'] as String?),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  static BorrowStatus _parseBorrowStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'BORROWING':
        return BorrowStatus.borrowing;
      case 'RETURNED':
        return BorrowStatus.returned;
      case 'OVERDUE':
        return BorrowStatus.overdue;
      default:
        return BorrowStatus.borrowing;
    }
  }

  /// 获取状态文本
  String getStatusText() {
    switch (status) {
      case BorrowStatus.borrowing:
        return '借阅中';
      case BorrowStatus.returned:
        return '已归还';
      case BorrowStatus.overdue:
        return '逾期';
    }
  }

  /// 获取状态颜色
  Color getStatusColor() {
    switch (status) {
      case BorrowStatus.borrowing:
        return Colors.blue;
      case BorrowStatus.returned:
        return Colors.green;
      case BorrowStatus.overdue:
        return Colors.red;
    }
  }

  /// 是否逾期
  bool get isOverdue {
    if (returnedAt != null) return false;
    return DateTime.now().isAfter(dueAt);
  }

  /// 是否可以续借
  bool get canRenew {
    return status == BorrowStatus.borrowing &&
           renewCount < maxRenewCount &&
           !isOverdue;
  }

  /// 剩余天数
  int get remainingDays {
    if (returnedAt != null) return 0;
    final now = DateTime.now();
    final difference = dueAt.difference(now);
    return difference.inDays;
  }

  /// 格式化时间
  String formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  /// 格式化日期
  String formatDate(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')}';
  }
}
