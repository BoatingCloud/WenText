import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../providers/pending_approvals_provider.dart';
import '../providers/my_applications_provider.dart';
import '../providers/my_borrows_provider.dart';
import '../widgets/pending_approvals_tab.dart';
import '../widgets/my_applications_tab.dart';
import '../widgets/my_borrows_tab.dart';

/// 待办中心页面
class TodoCenterScreen extends HookConsumerWidget {
  const TodoCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabController = useTabController(initialLength: 3);
    final currentTab = useState<int>(0);

    // 监听Tab切换
    useEffect(() {
      void onTabChanged() {
        currentTab.value = tabController.index;
      }

      tabController.addListener(onTabChanged);
      return () => tabController.removeListener(onTabChanged);
    }, [tabController]);

    // 初始化加载
    useEffect(() {
      Future.microtask(() {
        ref.read(pendingApprovalsProvider.notifier).loadApprovals();
        ref.read(myApplicationsProvider.notifier).loadApplications();
        ref.read(myBorrowsProvider.notifier).loadBorrows();
      });
      return null;
    }, []);

    return Scaffold(
      appBar: AppBar(
        title: const Text('待办中心'),
        bottom: TabBar(
          controller: tabController,
          tabs: const [
            Tab(
              icon: Icon(Symbols.approval),
              text: '待我审批',
            ),
            Tab(
              icon: Icon(Symbols.description),
              text: '我的申请',
            ),
            Tab(
              icon: Icon(Symbols.book),
              text: '我的借阅',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: tabController,
        children: const [
          PendingApprovalsTab(),
          MyApplicationsTab(),
          MyBorrowsTab(),
        ],
      ),
    );
  }
}
