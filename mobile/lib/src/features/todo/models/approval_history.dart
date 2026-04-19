/// 审批历史记录
class ApprovalHistory {
  final String id;
  final String requestId;
  final String approverId;
  final String approverName;
  final String? approverDepartment;
  final String action; // APPROVED, REJECTED, TRANSFERRED
  final String? comment;
  final String? signatureUrl; // 电子签名URL
  final int? nodeOrder; // 审批节点顺序
  final String? nodeName; // 审批节点名称
  final DateTime createdAt;

  ApprovalHistory({
    required this.id,
    required this.requestId,
    required this.approverId,
    required this.approverName,
    this.approverDepartment,
    required this.action,
    this.comment,
    this.signatureUrl,
    this.nodeOrder,
    this.nodeName,
    required this.createdAt,
  });

  factory ApprovalHistory.fromJson(Map<String, dynamic> json) {
    return ApprovalHistory(
      id: json['id'] as String,
      requestId: json['requestId'] as String,
      approverId: json['approverId'] as String? ?? json['approver']?['id'] as String? ?? '',
      approverName: json['approverName'] as String? ?? json['approver']?['name'] as String? ?? '',
      approverDepartment: json['approverDepartment'] as String?,
      action: json['action'] as String,
      comment: json['comment'] as String?,
      signatureUrl: json['signatureUrl'] as String?,
      nodeOrder: json['nodeOrder'] as int?,
      nodeName: json['nodeName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// 获取操作文本
  String getActionText() {
    switch (action.toUpperCase()) {
      case 'APPROVED':
        return '通过';
      case 'REJECTED':
        return '驳回';
      case 'TRANSFERRED':
        return '转办';
      default:
        return action;
    }
  }

  /// 格式化时间
  String formatDateTime(DateTime dateTime) {
    return '${dateTime.year}-${dateTime.month.toString().padLeft(2, '0')}-${dateTime.day.toString().padLeft(2, '0')} '
        '${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}
