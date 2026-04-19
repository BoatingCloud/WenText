import 'package:flutter/material.dart';

/// 审批申请类型
enum ApprovalType {
  borrow,  // 借阅
  return_, // 归还
  renew,   // 续借
  destroy, // 销毁
}

/// 审批状态
enum ApprovalStatus {
  pending,  // 待审批
  approved, // 已通过
  rejected, // 已驳回
  canceled, // 已取消
}

/// 优先级
enum Priority {
  normal, // 普通
  urgent, // 紧急
}

/// 审批申请
class ApprovalRequest {
  final String id;
  final ApprovalType type;
  final ApprovalStatus status;
  final Priority priority;
  final String archiveId;
  final String archiveName;
  final String? archiveNumber;
  final String applicantId;
  final String applicantName;
  final String? applicantDepartment;
  final String reason;
  final DateTime? borrowedAt;
  final DateTime? dueAt;
  final DateTime? returnedAt;
  final String? currentApproverId;
  final String? currentApproverName;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isRead;

  ApprovalRequest({
    required this.id,
    required this.type,
    required this.status,
    this.priority = Priority.normal,
    required this.archiveId,
    required this.archiveName,
    this.archiveNumber,
    required this.applicantId,
    required this.applicantName,
    this.applicantDepartment,
    required this.reason,
    this.borrowedAt,
    this.dueAt,
    this.returnedAt,
    this.currentApproverId,
    this.currentApproverName,
    required this.createdAt,
    required this.updatedAt,
    this.isRead = false,
  });

  factory ApprovalRequest.fromJson(Map<String, dynamic> json) {
    // 处理嵌套的 archive 对象
    final archive = json['archive'] as Map<String, dynamic>?;
    final archiveId = json['archiveId'] as String? ?? archive?['id'] as String? ?? '';
    final archiveName = json['archiveName'] as String? ??
                       archive?['title'] as String? ??
                       archive?['name'] as String? ?? '';
    final archiveNumber = json['archiveNumber'] as String? ??
                         archive?['archiveNo'] as String?;

    // 处理嵌套的 applicant 对象
    final applicant = json['applicant'] as Map<String, dynamic>?;
    final applicantId = json['applicantId'] as String? ?? applicant?['id'] as String? ?? '';
    final applicantName = json['applicantName'] as String? ??
                         applicant?['name'] as String? ?? '';
    final applicantDepartment = json['applicantDepartment'] as String? ??
                               applicant?['department'] as String?;

    return ApprovalRequest(
      id: json['id'] as String,
      type: _parseApprovalType(json['type'] as String?),
      status: _parseApprovalStatus(json['status'] as String?),
      priority: _parsePriority(json['priority'] as String?),
      archiveId: archiveId,
      archiveName: archiveName,
      archiveNumber: archiveNumber,
      applicantId: applicantId,
      applicantName: applicantName,
      applicantDepartment: applicantDepartment,
      reason: json['reason'] as String? ?? json['borrowReason'] as String? ?? '',
      borrowedAt: json['borrowedAt'] != null
          ? DateTime.parse(json['borrowedAt'] as String)
          : json['expectedBorrowAt'] != null
              ? DateTime.parse(json['expectedBorrowAt'] as String)
              : null,
      dueAt: json['dueAt'] != null
          ? DateTime.parse(json['dueAt'] as String)
          : json['expectedReturnAt'] != null
              ? DateTime.parse(json['expectedReturnAt'] as String)
              : null,
      returnedAt: json['returnedAt'] != null
          ? DateTime.parse(json['returnedAt'] as String)
          : null,
      currentApproverId: json['currentApproverId'] as String?,
      currentApproverName: json['currentApproverName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      isRead: json['isRead'] as bool? ?? false,
    );
  }

  static ApprovalType _parseApprovalType(String? type) {
    switch (type?.toUpperCase()) {
      case 'BORROW':
        return ApprovalType.borrow;
      case 'RETURN':
        return ApprovalType.return_;
      case 'RENEW':
        return ApprovalType.renew;
      case 'DESTROY':
        return ApprovalType.destroy;
      default:
        return ApprovalType.borrow;
    }
  }

  static ApprovalStatus _parseApprovalStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return ApprovalStatus.pending;
      case 'APPROVED':
        return ApprovalStatus.approved;
      case 'REJECTED':
        return ApprovalStatus.rejected;
      case 'CANCELED':
        return ApprovalStatus.canceled;
      default:
        return ApprovalStatus.pending;
    }
  }

  static Priority _parsePriority(String? priority) {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return Priority.urgent;
      case 'NORMAL':
      default:
        return Priority.normal;
    }
  }

  /// 获取类型文本
  String getTypeText() {
    switch (type) {
      case ApprovalType.borrow:
        return '借阅申请';
      case ApprovalType.return_:
        return '归还申请';
      case ApprovalType.renew:
        return '续借申请';
      case ApprovalType.destroy:
        return '销毁申请';
    }
  }

  /// 获取类型图标
  IconData getTypeIcon() {
    switch (type) {
      case ApprovalType.borrow:
        return Icons.book_outlined;
      case ApprovalType.return_:
        return Icons.assignment_return_outlined;
      case ApprovalType.renew:
        return Icons.update_outlined;
      case ApprovalType.destroy:
        return Icons.delete_outline;
    }
  }

  /// 获取状态文本
  String getStatusText() {
    switch (status) {
      case ApprovalStatus.pending:
        return '待审批';
      case ApprovalStatus.approved:
        return '已通过';
      case ApprovalStatus.rejected:
        return '已驳回';
      case ApprovalStatus.canceled:
        return '已取消';
    }
  }

  /// 获取状态颜色
  Color getStatusColor() {
    switch (status) {
      case ApprovalStatus.pending:
        return Colors.orange;
      case ApprovalStatus.approved:
        return Colors.green;
      case ApprovalStatus.rejected:
        return Colors.red;
      case ApprovalStatus.canceled:
        return Colors.grey;
    }
  }

  /// 获取优先级文本
  String getPriorityText() {
    switch (priority) {
      case Priority.normal:
        return '普通';
      case Priority.urgent:
        return '紧急';
    }
  }

  /// 获取优先级颜色
  Color getPriorityColor() {
    switch (priority) {
      case Priority.normal:
        return Colors.blue;
      case Priority.urgent:
        return Colors.red;
    }
  }

  /// 格式化时间
  String formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}
