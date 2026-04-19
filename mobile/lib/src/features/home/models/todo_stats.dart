/// 待办事项统计
class TodoStats {
  final int pendingApproval;  // 待审批
  final int pendingArchive;   // 待归档
  final int pendingBorrow;    // 待借阅

  TodoStats({
    required this.pendingApproval,
    required this.pendingArchive,
    required this.pendingBorrow,
  });

  int get total => pendingApproval + pendingArchive + pendingBorrow;
}
